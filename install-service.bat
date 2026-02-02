@echo off
nssm install MCDashboard "C:\Program Files\nodejs\node.exe" "D:\DEV\RCON\server.js"
nssm set MCDashboard AppDirectory "D:\DEV\RCON"
nssm set MCDashboard DisplayName "MC Dashboard"
nssm set MCDashboard Start SERVICE_AUTO_START
nssm set MCDashboard AppStdout "D:\DEV\RCON\dashboard.log"
nssm set MCDashboard AppStderr "D:\DEV\RCON\dashboard.log"
nssm set MCDashboard AppStdoutCreationDisposition 4
nssm set MCDashboard AppStderrCreationDisposition 4
nssm start MCDashboard
sc query MCDashboard
pause
