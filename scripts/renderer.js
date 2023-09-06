const { ipcRenderer } = require('electron');

function setInputElementValue(elementId, value) {
    if (value) {
        document.getElementById(elementId).value = value;
    }
}

function getStoredSettingsAndPopulate() {
    const storedSettings = ipcRenderer.sendSync('get-settings');

    if (storedSettings) {
        setInputElementValue('url', storedSettings.url);
        setInputElementValue('username', storedSettings.username);
        setInputElementValue('password', storedSettings.password);
    }
}

function submitSettings() {
    event.preventDefault();
    const url = document.getElementById('url').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    console.log("Sending URL:", url);
    ipcRenderer.send('set-settings', { url, username, password });
    window.close();
}

function initializePage() {
    getStoredSettingsAndPopulate();

    const button = document.getElementById('submitSettingsButton');
    if (button) {
        button.addEventListener('click', submitSettings);
    }
}

document.addEventListener('DOMContentLoaded', initializePage);
