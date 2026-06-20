!include "MUI2.nsh"

Name "BOORAT"
OutFile "BOORATSetup.exe"
InstallDir "$PROGRAMFILES\BOORAT"
RequestExecutionLevel admin

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File "boorat.exe"

  ; Built-in Distribte extension
  SetOutPath "$INSTDIR\builtin-extensions\distribte"
  File /r "builtin-extensions\distribte\*.*"

  ; Create proxies folder in user's .antidetect directory
  CreateDirectory "$PROFILE\.antidetect\proxies"
  SetOutPath "$PROFILE\.antidetect\proxies"
  File "PROXY.csv"

  SetOutPath "$INSTDIR"
  CreateDirectory "$SMPROGRAMS\BOORAT"
  CreateShortcut "$SMPROGRAMS\BOORAT\BOORAT.lnk" "$INSTDIR\boorat.exe"
  CreateShortcut "$DESKTOP\BOORAT.lnk" "$INSTDIR\boorat.exe"

  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Register in Add/Remove Programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BOORAT" "DisplayName" "BOORAT"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BOORAT" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BOORAT" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BOORAT" "Publisher" "BOORAT"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BOORAT" "DisplayVersion" "1.0.1"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BOORAT" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BOORAT" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\boorat.exe"
  Delete "$INSTDIR\uninstall.exe"
  RMDir /r "$INSTDIR\builtin-extensions"
  Delete "$SMPROGRAMS\BOORAT\BOORAT.lnk"
  Delete "$DESKTOP\BOORAT.lnk"
  RMDir "$SMPROGRAMS\BOORAT"
  RMDir "$INSTDIR"

  ; Remove from Add/Remove Programs
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BOORAT"
SectionEnd
