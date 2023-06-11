class IngamePanelPEHelperPanel extends TemplateElement {
    constructor() {
        super(...arguments);

        this.panelActive = false;
        this.started = false;
        this.peRunning = false;
        this.peStatus = null;
        this.peTimer = -1;
        this.peError = null;
        this.ingameUi = null;
        this.busy = false;
        this.debugEnabled = false;

        // generate a connection UUID that the PE Client can use to manage our session
        this.connectionId = this.uuidv4();
    }

    // https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
    uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    connectedCallback() {
        super.connectedCallback();

        var self = this;
        this.ingameUi = this.querySelector('ingame-ui');

        if (this.ingameUi) {
            this.ingameUi.addEventListener("panelActive", (e) => {
                //console.log('panelActive');
                self.panelActive = true;
                self.initialize();

                // always assume PE is not running at initialization
                // set to true to ensure toggle is successful below
                self.peRunning = true;

                // disable user controls when not PE is not running
                self.toggleRunningStatus(false);

                // ensure user controls are disabled until we verify PE is running
                self.toggleUserInputs(false);

                // request status update from PE Client every 500ms
                self.setPEUpdateTimer(500);

                // force initial update of PE Client status
                self.updatePEStatus();
            });
            this.ingameUi.addEventListener("panelInactive", (e) => {
                //console.log('panelInactive');
                self.panelActive = false;
                self.setPEUpdateTimer(-1); // disable updates closed
            });
            this.ingameUi.addEventListener("onResizeElement", () => {});
            this.ingameUi.addEventListener("dblclick", () => {});
        }
    }
    initialize() {
        if (this.started) {
            return;
        }

        var self = this;

        console.log("Initialize PE Helper");

        self.m_Status = self.querySelector('.pe-status');

        self.m_Message = self.querySelector('.pe-message');


        self.m_Connect = self.querySelector('.pe-connect-disconnect');
        self.m_Connect.disabled = true;
        self.m_Connect.addEventListener('click', () => { self.doPEConnect() });

        self.m_User_Callsign = document.querySelector('.pe-callsign');
        self.m_User_Callsign.maxLength = 10;
        self.m_User_Callsign.addEventListener('keypress', (event) => {
            if (event.keyCode == KeyCode.KEY_ENTER)
                self.doPEConnect();
        });

        self.m_User_Type = document.querySelector('.pe-type');
        self.m_User_Type.maxLength = 4;
        self.m_User_Type.addEventListener('keypress', (event) => {
            if (event.keyCode == KeyCode.KEY_ENTER)
                self.doPEConnect();
        });

        self.m_User_Airline = document.querySelector('.pe-airline');
        self.m_User_Airline.maxLength = 3;
        self.m_User_Airline.addEventListener('keypress', (event) => {
            if (event.keyCode == KeyCode.KEY_ENTER)
                self.doPEConnect();
        });

        self.m_User_Livery = document.querySelector('.pe-livery');
        self.m_User_Livery.maxLength = 200;
        self.m_User_Livery.addEventListener('keypress', (event) => {
            if (event.keyCode == KeyCode.KEY_ENTER)
                self.doPEConnect();
        });


        self.m_ATIS_Get = document.querySelector('.pe-atis-get');
        self.m_ATIS_Get.addEventListener('click', () => { self.doPEGetAtis() });

        self.m_ATIS_Airport = document.querySelector('.pe-atis-airport');
        self.m_ATIS_Airport.maxLength = 4;
        self.m_ATIS_Airport.addEventListener('keypress', (event) => {
            if (event.keyCode == KeyCode.KEY_ENTER)
                self.doPEGetAtis();
        });

        self.m_ATIS_Frame = document.querySelector('div.pe-atis-frame');
        self.m_ATIS_Frame.innerHTML = `<iframe class='pe-atis-frame'></iframe>`;
        var iframe = document.querySelector('iframe.pe-atis-frame');
        iframe.contentWindow.document.body.innerHTML = 'Enter an ICAO airport identifier above and click [Get ATIS].<br><br>Use mouse wheel to scroll.';

        this.started = true;
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    updateImage() {}

    setPEUpdateTimer(interval) {
        // Manages update timer for PE Client status
        var self = this;

        // Always clear any existing timers
        if (self.peTimer != -1) {
            clearInterval(self.peTimer);
            self.peTimer = -1;
        }

        // A value less or equal to zero indicates to disable timer
        if (interval <= 0)
            return;

        // Set a new recurring timer to update status from the PE Client
        self.peTimer = setInterval(() => { self.updatePEStatus(); }, interval);
    }

    doPEGetAtis() {
        // Gets ATIS from PE API and displays to user
        var self = this;

        var airport = self.m_ATIS_Airport.value;
        if (airport) airport = airport.trim().toUpperCase();
        else airport = '';

        // Check if entered airport code is valid; All valid PE airports with ATIS should be 4 chars in length
        if (airport.length != 4) {
            self.m_ATIS_Frame.innerHTML = `<iframe class='pe-atis-frame'></iframe>`;
            var iframe = document.querySelector('iframe.pe-atis-frame');
            iframe.contentWindow.document.body.innerHTML = 'Invalid airport identifier';
            return;
        }

        // Set a temp status message in case loading ATIS takes a few seconds; Also allows "browser" to release previous iframe resources
        self.m_ATIS_Frame.innerHTML = `Loading: ${airport}`;

        // If we update the source URL of an existing iframe it will send a CORS Origin header that the PE server does not like;
        // Work around is to recreate the iframe everytime we request an updated ATIS.
        self.m_ATIS_Frame.innerHTML = `<iframe class='pe-atis-frame' src='https://www.pilotedge.net/atis/${airport}.txt'></iframe>`;

        // We are unable to do a fetch() due to the CORS Origin header that the MSFS "browser" adds to the request.
        // While we could work around this by using a CORS proxy, that would require a 3rd party server.
        // [Error] Origin coui://html_ui is not allowed by Access-Control-Allow-Origin.
        // [Error] Failed to load resource: Origin coui://html_ui is not allowed by Access-Control-Allow-Origin. (KSMX.json, line 0)
        // [Error] XMLHttpRequest cannot load https://www.pilotedge.net/atis/KSMX.json due to access control checks.
        /*fetch(`https://www.pilotedge.net/atis/${airport}.json`, { method: 'GET' })
            .then(response => response.json())
            .then(data => {
              console.log(data);
            })
            .catch((error) => {
              console.error('Error:', error);
            });*/
    }

    onPEStatusUpdated() {
        // it should be fine to do all of this work on every update;
        // the PE client only sends a status update when something actually changes
        var self = this;

        var connected = false;
        var current = false;
        if (self.peStatus)
            current = self.peStatus.IsConnected;

        //console.log(self.peStatus);

        if (self.peRunning && self.peStatus) {
            connected = self.peStatus.IsConnected;
            self.m_Connect.enableState(true, connected);

            self.m_User_Callsign.setValue(self.peStatus.Callsign);
            self.m_User_Type.setValue(self.peStatus.TypeCode);
            self.m_User_Airline.setValue(self.peStatus.AirlineCode);
            self.m_User_Livery.setValue(self.peStatus.Livery);
        }

        self.toggleUserInputs(!connected);
    }

    toggleUserInputs(enabled) {
        // helper method to enable or disable user inputs
        var self = this;

        try {
            self.m_User_Callsign.disabled = !enabled;
            self.m_User_Type.disabled = !enabled;
            self.m_User_Airline.disabled = !enabled;
            self.m_User_Livery.disabled = !enabled;

            // current MSFS ui-input implementation does not disable inner input control
            var input = document.querySelector('.pe-callsign input');
            input.disabled = !enabled;
            //input.readOnly = !enabled;

            input = document.querySelector('.pe-type input');
            input.disabled = !enabled;
            //input.readOnly = !enabled;

            input = document.querySelector('.pe-airline input');
            input.disabled = !enabled;
            //input.readOnly = !enabled;

            input = document.querySelector('.pe-livery input');
            input.disabled = !enabled;
            //input.readOnly = !enabled;
        } catch (e) {
            console.log(e);
        }
    }

    toggleRunningStatus(running) {
        var self = this;
        if (self.peRunning != running) {
            console.log("PilotEdge Client is" + (running ? '' : ' not') + ' running');
            self.peRunning = running;
            self.m_Status.innerHTML = running ? 'Running' : 'Not Running';
            self.m_Status.classList.toggle('pe-on', running);
            self.m_Status.classList.toggle('pe-off', !running);
            self.m_Connect.disabled = !running;
            if (running)
                self.setPEMessage('Click [Connect] to connect to PilotEdge', false);
            else
                self.setPEMessage('The PilotEdge Client is not running!', true);
        }
    }

    setPEMessage(msg, iserror) {
        var self = this;
        // there is a chance this could be called while the window is still hidden
        self.m_Message.innerHTML = msg;
        self.m_Message.classList.toggle('pe-error', iserror);
    }

    updatePEStatus() {
        // Sends request to PE Client's API server requesting any events that have happened
        // since the last time that this method was called.

        //console.log("Updating PilotEdge status");
        var self = this;

        // make sure there is a default state to use if the PE client 
        // is connected before the add-on starts
        if (!self.peStatus)
            self.peStatus = {
                IsConnected: false,
                IsSquawkingModeC: false,
                IsSquawkingIdent: false,
                Callsign: '',
                TypeCode: '',
                AirlineCode: '',
                Livery: ''
            };

        fetch("http://localhost:8081/api/events?connectionId=" + self.connectionId, { method: 'GET' })
            .then(response => response.json())
            .then(data => {
                // ensure update on first update or if user starts PE after the add-on is running
                self.toggleRunningStatus(true);

                //if (data.length > 0)
                //    console.log(data);

                for (var i = 0; i < data.length; i++) {
                    if (data[i].Topic == 'NotificationPosted') {
                        // these are messages displayed in the web interface or console
                        // we are only interested in displaying errors to the user
                        if (data[i].Args.Type == 'Error') {
                            // only store last error during connection attempt... the other errors seems a bit spurious
                            if (!self.peStatus.IsConnected) {
                                self.peError = data[i].Args.Message;
                                if (self.peError.length <= 30) { // is there a way to measure the length of the string?
                                    self.setPEMessage('Error: ' + self.peError, true);
                                } else {
                                    self.setPEMessage('Error: See console for details', true);
                                }
                            }
                            self.onPEStatusUpdated();
                        }
                        continue;
                    } else if (data[i].Topic == 'CommandValidationFailed') {
                        // I think this only happens during connection if the user enters invalid data
                        self.peError = data[i].Args.ErrorMessage;
                        if (self.peError.length <= 30) {
                            self.setPEMessage('Error: ' + self.peError, true);
                        } else {
                            self.setPEMessage('Error: See console for details', true);
                        }
                        self.onPEStatusUpdated();
                        continue;
                    } else if (data[i].Topic == 'SystemStatePublished') {
                        self.peStatus = data[i].Args;
                        self.peStatus.IsSquawkingIdent = false; // not included?
                        self.onPEStatusUpdated();
                        continue;
                    } else if (data[i].Topic == 'NetworkConnected') {
                        // NetworkConnected is the final event in the connection sequence
                        self.peStatus.IsConnected = true;
                        self.peStatus.Callsign = data[i].Args.Callsign;
                        self.peStatus.TypeCode = data[i].Args.TypeCode;
                        self.peStatus.AirlineCode = data[i].Args.AirlineCode;
                        self.peStatus.Livery = data[i].Args.Livery;
                        self.peError = null; // if we are successfully connected, reset the last error status
                        self.setPEMessage(`Connected to PilotEdge as ${self.peStatus.Callsign} (${self.peStatus.TypeCode})`, false);
                        self.onPEStatusUpdated();
                        continue;
                    } else if (data[i].Topic == 'NetworkDisconnected') {
                        // NetworkDisconnected is the final event in the disconnect sequence
                        self.peStatus.IsConnected = false;
                        if (data[i].Args.DisconnectInfo) { // DisconnectInfo always seems to be available... is this necessary?
                            if (data[i].Args.DisconnectInfo.Reason && data[i].Args.DisconnectInfo.Reason != '') {
                                // There seems to be 3 disconnect types: Failure, Forcible, and Intentional;
                                // Failure and Forcible seem to be interchangeable. Just check for a Reason for now.
                                self.peError = data[i].Args.DisconnectInfo.Reason;
                                if (self.peError.length <= 30) {
                                    self.setPEMessage('Disconnected: ' + self.peError, true);
                                } else {
                                    self.setPEMessage('Disconnected: See console for details', true);
                                }
                            } else
                                self.peError = null; // disconnected but no error?
                        } else
                            self.peError = null;
                        if (!self.peError)
                            self.setPEMessage('Click [Connect] to connect to PilotEdge', false);
                        self.onPEStatusUpdated();
                        continue;
                    } else if (data[i].Topic == 'SquawkingModeCChanged') {
                        // Transponder ALT mode enabled
                        self.peStatus.IsSquawkingModeC = data[i].Args.SquawkingModeC;
                        self.onPEStatusUpdated();
                        continue;
                    } else if (data[i].Topic == 'SquawkingIdentChanged') {
                        // Ident pressed in our client or PE client; Will this be triggered when the ident simvar is used in the future?
                        self.peStatus.IsSquawkingIdent = data[i].Args.SquawkingIdent;
                        self.onPEStatusUpdated();
                        continue;
                    }
                }
            })
            .catch((error) => {
                console.log(error);
                // Unable to connect to the PE Client's API server... not running?
                self.toggleRunningStatus(false);
            });
    }

    sendPECommand(cmd) {
        var self = this;

        //console.log(cmd);

        fetch('http://localhost:8081/api/commands', {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cmd)
            })
            .then(response => {
                //console.log(response);
                self.updatePEStatus();
            })
            .catch((error) => {
                // unable to connect? should we completely disconnect?
                console.log(error);
            });
    }

    doPEConnect() {
        var self = this;

        //console.log('connect-disconnect');

        if (self.peStatus.IsConnected) {
            // PE is connected; Perform disconnect

            self.m_Connect.disabled = true;

            self.setPEMessage('Disconnecting from PilotEdge...', false);

            self.sendPECommand({
                '$type': 'PilotEdge.PilotClient.Commands.Commands.DisconnectFromNetworkCommand, PilotEdge.PilotClient'
            });
            return;
        }

        var callsign = self.m_User_Callsign.value;
        if (callsign) callsign = callsign.trim().toUpperCase();
        else callsign = '';
        var valid = callsign.length > 3 && callsign.length <= 10;
        document.querySelector('.pe-callsign-validation').innerHTML = valid ? '' : '(invalid)';
        if (!valid)
            return;

        var type = self.m_User_Type.value;
        if (type) type = type.trim().toUpperCase();
        else type = '';
        valid = type.length > 0 && type.length <= 4;
        document.querySelector('.pe-type-validation').innerHTML = valid ? '' : '(invalid)';
        if (!valid)
            return;

        var airline = self.m_User_Airline.value;
        if (airline) airline = airline.trim().toUpperCase();
        else airline = '';
        valid = airline.length == 0 || airline.length == 3;
        document.querySelector('.pe-airline-validation').innerHTML = valid ? '' : '(invalid)';
        if (!valid)
            return;

        var livery = self.m_User_Livery.value;
        if (livery) livery = livery.trim();
        else livery = '';

        self.m_Connect.disabled = true;

        self.setPEMessage('Connecting to PilotEdge...', false);

        self.sendPECommand({
            '$type': 'PilotEdge.PilotClient.Commands.Commands.ConnectToNetworkCommand, PilotEdge.PilotClient',
            'ConnectionParameters': {
                'Callsign': callsign,
                'TypeCode': type,
                'AirlineCode': airline,
                'Livery': livery
            }
        });
    }
}

window.customElements.define("ingamepanel-pe-helper", IngamePanelPEHelperPanel);
checkAutoload();