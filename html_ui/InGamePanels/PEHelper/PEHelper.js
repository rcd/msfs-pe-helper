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

        this.connectionId = this.uuidv4();

        this.initialize();
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
                self.updatePEStatus();
            });
            this.ingameUi.addEventListener("panelInactive", (e) => {
                //console.log('panelInactive');
                self.panelActive = false;
                self.setPEUpdateTimer(-1);
            });
            this.ingameUi.addEventListener("onResizeElement", () => {});
            this.ingameUi.addEventListener("dblclick", () => {});
        }
    }
    initialize() {
        if (this.started) {
            //return;
        }

        var self = this;

        console.log("Initialize PE Helper");

        self.m_Connect = document.querySelector('.pe-connect-disconnect');
        if (self.m_Connect)
            self.m_Connect.addEventListener('click', () => { self.doPEConnect() });

        self.m_User_Callsign = document.querySelector('.pe-callsign');
        if (self.m_User_Callsign)
            self.m_User_Callsign.maxLength = 10;

        self.m_User_Type = document.querySelector('.pe-type');
        if (self.m_User_Type)
            self.m_User_Type.maxLength = 4;

        self.m_User_Airline = document.querySelector('.pe-airline');
        if (self.m_User_Airline)
            self.m_User_Airline.maxLength = 3;

        self.m_User_Livery = document.querySelector('.pe-livery');
        if (self.m_User_Livery)
            self.m_User_Livery.maxLength = 200;

        self.setPEMessage('The PilotEdge Client is not running!', true);

        self.toggleUserInputs(true);


        self.m_ATIS_Get = document.querySelector('.pe-atis-get');
        if (self.m_ATIS_Get)
            self.m_ATIS_Get.addEventListener('click', () => { self.doPEGetAtis() });

        self.m_ATIS_Airport = document.querySelector('.pe-atis-airport');
        if (self.m_ATIS_Airport)
            self.m_ATIS_Airport.maxLength = 4;

        self.m_ATIS_Frame = document.querySelector('div.pe-atis-frame');
        if (self.m_ATIS_Frame) {
            self.m_ATIS_Frame.innerHTML = `<iframe class='pe-atis-frame'></iframe>`;
            var iframe = document.querySelector('iframe.pe-atis-frame');
            iframe.contentWindow.document.body.innerHTML = 'Enter an ICAO airport identifier above and click [Get ATIS].<br><br>Use mouse wheel to scroll.';
        }


        self.m_Ident = document.querySelector('.pe-ident');
        if (self.m_Ident)
            self.m_Ident.addEventListener('click', () => { self.doPEIdent() });


        self.setPEUpdateTimer(500);

        this.started = true;
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    updateImage() {}

    setPEUpdateTimer(interval) {
        var self = this;

        if (self.peTimer != -1) {
            clearInterval(self.peTimer);
            self.peTimer = -1;
        }

        if (interval <= 0)
            return;

        self.peTimer = setInterval(() => { self.updatePEStatus(); }, interval);
    }

    doPEGetAtis() {
        var self = this;

        if (!self.m_ATIS_Airport)
            self.m_ATIS_Airport = document.querySelector('.pe-atis-airport');

        if (!self.m_ATIS_Frame)
            self.m_ATIS_Frame = document.querySelector('div.pe-atis-frame');

        var airport = self.m_ATIS_Airport.value.trim();
        if (airport.length < 3 || airport.length > 4) {
            self.m_ATIS_Frame.innerHTML = `<iframe class='pe-atis-frame'></iframe>`;
            var iframe = document.querySelector('iframe.pe-atis-frame');
            iframe.contentWindow.document.body.innerHTML = 'Invalid airport identifier';
            return;
        }

        airport = airport.toUpperCase();

        self.m_ATIS_Frame.innerHTML = `Loading: ${airport}`;
        self.m_ATIS_Frame.innerHTML = `<iframe class='pe-atis-frame' src='https://www.pilotedge.net/atis/${airport}.txt'></iframe>`;


        /*fetch(`https://cors-anywhere.herokuapp.com/https://www.pilotedge.net/atis/${airport}.json`, { method: 'GET' })
            .then(response => response.json())
            .then(data => {
              console.log(data);
            })
            .catch((error) => {
              console.error('Error:', error);
            });*/
    }

    onPEStatusUpdated() {
        var self = this;

        var connected = false;

        //console.log(self.peStatus);

        if (!self.m_User_Callsign)
            self.m_User_Callsign = document.querySelector('.pe-callsign');

        if (!self.m_User_Type)
            self.m_User_Type = document.querySelector('.pe-type');

        if (!self.m_User_Airline)
            self.m_User_Airline = document.querySelector('.pe-airline');

        if (!self.m_User_Livery)
            self.m_User_Livery = document.querySelector('.pe-livery');

        if (!self.m_Connect)
            self.m_Connect = document.querySelector('.pe-connect-disconnect');

        if (!self.m_ModeC)
            self.m_ModeC = document.querySelector('.pe-modec');

        if (!self.m_Ident)
            self.m_Ident = document.querySelector('.pe-ident');

        if (self.peStatus) {
            connected = self.peStatus.IsConnected;
            self.m_Connect.enableState(true, connected);

            self.m_User_Callsign.value = self.peStatus.Callsign;
            self.m_User_Type.value = self.peStatus.TypeCode;
            self.m_User_Airline.value = self.peStatus.AirlineCode;
            self.m_User_Livery.value = self.peStatus.Livery;

            if (self.peStatus.IsSquawkingModeC) {
                self.m_ModeC.innerHTML = 'ON';
                self.m_ModeC.classList.toggle('pe-on', true);
                self.m_ModeC.classList.toggle('pe-off', false);
            } else {
                self.m_ModeC.innerHTML = 'OFF';
                self.m_ModeC.classList.toggle('pe-on', false);
                self.m_ModeC.classList.toggle('pe-off', true);
            }

            self.m_Ident.enableState(true, self.peStatus.IsSquawkingIdent);
        }

        self.toggleUserInputs(!connected);

        if (!self.m_Status)
            self.m_Status = document.querySelector('.pe-status');

        if (self.peRunning) {
            self.m_Status.innerHTML = 'Running';
            self.m_Status.classList.toggle('pe-on', true);
            self.m_Status.classList.toggle('pe-off', false);
            self.m_Connect.disabled = false;
            self.m_Ident.disabled = !connected;
        } else {
            self.m_Status.innerHTML = 'Not Running';
            self.m_Status.classList.toggle('pe-on', false);
            self.m_Status.classList.toggle('pe-off', true);
            self.m_Connect.disabled = true;
            self.m_Ident.disabled = true;
        }
    }

    toggleUserInputs(enabled) {
        var self = this;

        try {
            self.m_User_Callsign.disabled = !enabled;
            self.m_User_Type.disabled = !enabled;
            self.m_User_Airline.disabled = !enabled;
            self.m_User_Livery.disabled = !enabled;

            // current MSFS ui-input implementation does not disable inner input control
            document.querySelector('.pe-callsign input').disabled = !enabled;
            document.querySelector('.pe-type input').disabled = !enabled;
            document.querySelector('.pe-airline input').disabled = !enabled;
            document.querySelector('.pe-livery input').disabled = !enabled;
        } catch (e) {
            //console.log(e);
        }
    }

    setPEMessage(msg, iserror) {
        if (!self.m_Message)
            self.m_Message = document.querySelector('.pe-message');

        if (self.m_Message) {
            self.m_Message.innerHTML = msg;
            self.m_Message.classList.toggle('pe-error', iserror);
        }
    }

    updatePEStatus() {
        //console.log("Updating PilotEdge status");
        var self = this;

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
                for (var i = 0; i < data.length; i++) {
                    if (!self.peRunning) {
                        self.peRunning = true;
                        self.setPEMessage('Click [Connect] to connect to PilotEdge', false);
                    }

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
                        self.peStatus.IsConnected = true;
                        self.peStatus.Callsign = data[i].Args.Callsign;
                        self.peStatus.TypeCode = data[i].Args.TypeCode;
                        self.peStatus.AirlineCode = data[i].Args.AirlineCode;
                        self.peStatus.Livery = data[i].Args.Livery;
                        self.peError = null; // if we are successfully connected, reset the last error status
                        self.setPEMessage('Connected to PilotEdge as ' + self.peStatus.Callsign, false);
                        self.onPEStatusUpdated();
                        continue;
                    } else if (data[i].Topic == 'NetworkDisconnected') {
                        self.peStatus.IsConnected = false;
                        if (data[i].Args.DisconnectInfo) {
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
                            self.peError = null; // DisconnectInfo always seems to be available... is this necessary?
                        if (!self.peError)
                            self.setPEMessage('Click [Connect] to connect to PilotEdge', false);
                        self.onPEStatusUpdated();
                        continue;
                    } else if (data[i].Topic == 'SquawkingModeCChanged') {
                        self.peStatus.IsSquawkingModeC = data[i].Args.SquawkingModeC;
                        self.onPEStatusUpdated();
                        continue;
                    } else if (data[i].Topic == 'SquawkingIdentChanged') {
                        self.peStatus.IsSquawkingIdent = data[i].Args.SquawkingIdent;
                        self.onPEStatusUpdated();
                        continue;
                    }
                }
            })
            .catch((error) => {
                self.setPEMessage('The PilotEdge Pilot Client is not running!', true);

                if (self.peRunning) {
                    self.peRunning = false;
                    self.onPEStatusUpdated();
                }
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

        var callsign = self.m_User_Callsign.value.trim().toUpperCase();
        var valid = callsign.length > 3 && callsign.length <= 10;
        document.querySelector('.pe-callsign-validation').innerHTML = valid ? '' : '(invalid)';
        if (!valid)
            return;

        var type = self.m_User_Type.value.trim().toUpperCase();
        valid = type.length > 0 && type.length <= 4;
        document.querySelector('.pe-type-validation').innerHTML = valid ? '' : '(invalid)';
        if (!valid)
            return;

        var airline = self.m_User_Airline.value.trim().toUpperCase();
        valid = airline.length == 0 || airline.length == 3;
        document.querySelector('.pe-airline-validation').innerHTML = valid ? '' : '(invalid)';
        if (!valid)
            return;

        var livery = self.m_User_Livery.value.trim();

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

    doPEIdent() {
        var self = this;

        if (!self.peStatus.IsConnected || self.peStatus.IsSquawkingIdent)
            return;

        self.peStatus.IsSquawkingIdent = true;

        self.sendPECommand({
            '$type': 'PilotEdge.PilotClient.Commands.Commands.SquawkIdentCommand, PilotEdge.PilotClient'
        });
    }
}

window.customElements.define("ingamepanel-pe-helper", IngamePanelPEHelperPanel);
checkAutoload();