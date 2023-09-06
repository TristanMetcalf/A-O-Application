const { app, BrowserWindow, ipcMain, Menu, session } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const cookiesPath = path.join(app.getPath('userData'), 'cookies.json');

let mainWindow;

// Main Window creation and events
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        icon: path.join(__dirname, 'icons', 'icon.png'),  
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: false,
        }
    });
    mainWindow.maximize();

    mainWindow.webContents.on('dom-ready', handleDomReady);

    mainWindow.on('closed', () => app.quit());
    mainWindow.on('close', storeCookies);

    setMainWindowURL();
    setMainMenu();
}

function handleDomReady() {
    const storedSettings = getStoredSettings();

    // This script checks if there's a "login-failed" div visible on the page
    const checkForLoginFailedScript = `
        const loginFailedElem = document.getElementById('login-failed');
        loginFailedElem && getComputedStyle(loginFailedElem).display !== 'none' ? true : false;
    `;

    mainWindow.webContents.executeJavaScript(checkForLoginFailedScript).then(isLoginFailed => {
        // If there's no login-failed visible and stored settings exist, attempt a login
        if (!isLoginFailed && storedSettings && storedSettings.username && storedSettings.password) {
            const loginScript = `
                document.getElementById('username').value = "${storedSettings.username}";
                document.getElementById('password').value = "${storedSettings.password}";
                document.getElementById('login-submit').click();
            `;

            mainWindow.webContents.executeJavaScript(loginScript);
        }
    });

    // Continue with the rest of the function
    const disableLinksCSS = `
        a[href="/deltav"][tabindex="0"],
        .breadcrumbs a {
            pointer-events: none;
        }
    `;
    mainWindow.webContents.insertCSS(disableLinksCSS);
}


function setMainWindowURL() {
    const storedURL = getStoredURL() || url.format({
        pathname: path.join(__dirname, 'html', 'instruction.html'),
        protocol: 'file:',
        slashes: true
    });
    mainWindow.loadURL(storedURL);
}

function setMainMenu() {
    const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
    Menu.setApplicationMenu(mainMenu);
}

// Input Window
function createInputWindow() {
    const inputWindow = new BrowserWindow({
        width: 400,
        height: 400,
        title: 'Set URL',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    inputWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'html', 'input.html'),
        protocol: 'file:',
        slashes: true
    }));
}

// Settings and URL handlers
function getStoredURL() {
    return (fs.existsSync(settingsPath) && JSON.parse(fs.readFileSync(settingsPath)).url) || null;
}

function getStoredSettings() {
    return (fs.existsSync(settingsPath) && JSON.parse(fs.readFileSync(settingsPath))) || null;
}

function storeSettings(settings) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings));
}

function storeURL(storedURL) {
    fs.writeFileSync(settingsPath, JSON.stringify({ url: storedURL }));
}

ipcMain.on('set-settings', (event, settings) => {
    storeSettings(settings);
    mainWindow.loadURL(settings.url);
});

ipcMain.on('get-settings', event => {
    event.returnValue = getStoredSettings();
});

ipcMain.on('set-url', (event, storedURL) => {
    storeURL(storedURL);
    mainWindow.loadURL(storedURL);
});

ipcMain.on('get-url', event => {
    event.returnValue = getStoredURL();
});

// Menu Template
const mainMenuTemplate = [
    {
        label: 'File',
        submenu: [
            {
                label: 'Set URL',
                click: createInputWindow
            },
            {
                label: 'Quit',
                accelerator: process.platform === 'darwin' ? 'Command+Q' : 'Ctrl+Q',
                click: () => app.quit()
            }
        ]
    }
];

// Dev Tools and Platform-specific adjustments
if (process.platform === 'darwin') {
    mainMenuTemplate.unshift({});
}
if (process.env.NODE_ENV !== 'production') {
    mainMenuTemplate.push({
        label: 'Developer Tools',
        submenu: [
            {
                label: 'Toggle DevTools',
                accelerator: process.platform === 'darwin' ? 'Command+I' : 'Ctrl+I',
                click: (item, focusedWindow) => focusedWindow.toggleDevTools()
            },
            { role: 'reload' }
        ]
    });
}

// Cookie Management
async function storeCookies() {
    const cookies = await session.defaultSession.cookies.get({});
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies));
}

async function setStoredCookies() {
    if (!fs.existsSync(cookiesPath)) return;

    const rawCookies = fs.readFileSync(cookiesPath, 'utf8');
    const cookies = JSON.parse(rawCookies);
    const promises = cookies
        .filter(cookie => cookie.url && cookie.name)
        .map(cookie => session.defaultSession.cookies.set(cookie));

    await Promise.all(promises);
}

// App Lifecycle
app.on('ready', async () => {
    await setStoredCookies();
    createMainWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (!mainWindow) {
        createMainWindow();
    }
});