#Requires AutoHotkey v2.0
#SingleInstance Force

; ============================================================
; TEST SCRIPT — processes first TEST_LIMIT files only
; Full run: change TEST_LIMIT to 0 (= no limit)
; ============================================================

; === CONFIG — edit these ===
VAULT_NAME   := "content"                          ; Obsidian vault name (exact, case-sensitive)
VAULT_ROOT   := "C:\Users\windows11\Documents\Github\kufrCleaner\src\content"
POSTS_REL    := "\posts"                   ; relative to vault root
UPLOAD_WAIT  := 8000   ; ms to wait for upload modal to finish
MODAL_CLOSE  := 1500   ; ms after Escape before closing file
FILE_OPEN    := 1500   ; ms after URI open before sending Ctrl+S
TEST_LIMIT   := 3      ; files to process in test (0 = all)

; === Derived ===
POSTS_DIR    := VAULT_ROOT POSTS_REL

; ============================================================
; Collect files
; ============================================================
files := []
Loop Files, POSTS_DIR "\*.md", "F" {
    files.Push(A_LoopFilePath)
    if TEST_LIMIT > 0 && files.Length >= TEST_LIMIT
        break
}

if files.Length = 0 {
    MsgBox "No .md files found in:`n" POSTS_DIR, "Error", "Icon!"
    ExitApp
}

result := MsgBox(
    "TEST MODE: will process " files.Length " files.`n`n"
    "Vault : " VAULT_NAME "`n"
    "Dir   : " POSTS_DIR "`n`n"
    "Make sure Obsidian is running. Press OK to start.",
    "Obsidian Image Upload", "OC Icon?"
)
if result = "Cancel"
    ExitApp

; ============================================================
; Main loop
; ============================================================
errors := []

for idx, filepath in files {
    SplitPath filepath, &fname

    ; Build file path relative to vault root (no extension, forward slashes)
    relPath := StrReplace(filepath, VAULT_ROOT "\", "")
    relPath := StrReplace(relPath, "\", "/")
    relPath := StrReplace(relPath, ".md", "")
    encodedPath := UriEncode(relPath)

    ToolTip "[" idx "/" files.Length "] Opening: " fname

    ; Open file in Obsidian via URI
    Run "obsidian://open?vault=" UriEncode(VAULT_NAME) "&file=" encodedPath
    Sleep FILE_OPEN

    ; Focus Obsidian window
    try WinActivate "ahk_exe Obsidian.exe"
    if !WinWaitActive("ahk_exe Obsidian.exe",, 5) {
        errors.Push(fname " — Obsidian did not come to foreground")
        continue
    }
    Sleep 300

    ; Trigger image upload plugin (Ctrl+S)
    Send "^s"
    ToolTip "[" idx "/" files.Length "] Uploading: " fname

    ; Wait for upload to complete
    ; --- Option A: fixed wait (current) ---
    Sleep UPLOAD_WAIT

    ; --- Option B (advanced): wait for modal to vanish by pixel color ---
    ; Uncomment and set coords after inspecting the modal's close-button pixel
    ; deadline := A_TickCount + 30000
    ; loop {
    ;     PixelGetColor &col, 960, 540  ; center of screen — adjust to modal
    ;     if col != 0x1E1E2E            ; background color of modal — adjust
    ;         break
    ;     if A_TickCount > deadline
    ;         break
    ;     Sleep 300
    ; }

    ; Dismiss modal (Escape)
    Send "{Escape}"
    Sleep MODAL_CLOSE

    ; Close file tab (Ctrl+W)
    Send "^w"
    Sleep 600
}

ToolTip
summary := "Done. Processed: " files.Length - errors.Length "/" files.Length
if errors.Length > 0 {
    summary .= "`n`nErrors:`n"
    for e in errors
        summary .= "  • " e "`n"
}
MsgBox summary, "Upload Complete", "Icon!"
ExitApp

; ============================================================
; Helper: percent-encode a URI component
; ============================================================
UriEncode(str) {
    static chars := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~/"
    out := ""
    loop parse, str {
        c := A_LoopField
        if InStr(chars, c)
            out .= c
        else {
            code := Ord(c)
            out .= "%" Format("{:02X}", code)
        }
    }
    return out
}
