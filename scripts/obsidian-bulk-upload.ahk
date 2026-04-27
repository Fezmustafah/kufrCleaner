#Requires AutoHotkey v2.0
#SingleInstance Force

; ============================================================
; Bulk image upload via Advanced URI
; Uses: image-upload-toolkit:publish-page
; No window focus needed — pure URI calls
; ============================================================

; === CONFIG ===
VAULT_NAME   := "content"
VAULT_ROOT   := "C:\Users\windows11\Documents\Github\kufrCleaner\src\content"
POSTS_DIR    := VAULT_ROOT "\posts"
UPLOAD_WAIT  := 12000  ; ms to wait for upload to complete per file
CLOSE_WAIT   := 1000   ; ms after close URI before next file
TEST_LIMIT   := 0      ; 0 = all files, N = stop after N files

UPLOAD_CMD   := "image-upload-toolkit%3Apublish-page"
CLOSE_CMD    := "workspace%3Aclose"

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
    "Bulk upload " files.Length " files.`n`n"
    "Vault  : " VAULT_NAME "`n"
    "Posts  : " POSTS_DIR "`n"
    "Wait   : " UPLOAD_WAIT "ms per file`n`n"
    "Make sure Obsidian is open. Press OK to start.",
    "Obsidian Bulk Upload", "OC Icon?"
)
if result = "Cancel"
    ExitApp

; ============================================================
; Main loop
; ============================================================
errors := []
skipped := 0

for idx, filepath in files {
    SplitPath filepath, &fname

    ; filepath relative to vault root, forward slashes, no extension
    relPath := StrReplace(filepath, VAULT_ROOT "\", "")
    relPath := StrReplace(relPath, "\", "/")
    relPath := StrReplace(relPath, ".md", "")
    encodedPath := UriEncode(relPath)

    ToolTip "[" idx "/" files.Length "] Uploading: " fname

    ; Open file + trigger upload command
    uploadURI := "obsidian://adv-uri?vault=" UriEncode(VAULT_NAME)
        . "&filepath=" encodedPath
        . "&commandid=" UPLOAD_CMD
    Run uploadURI

    ; Wait for upload to complete
    Sleep UPLOAD_WAIT

    ; Close the tab
    closeURI := "obsidian://adv-uri?vault=" UriEncode(VAULT_NAME)
        . "&filepath=" encodedPath
        . "&commandid=" CLOSE_CMD
    Run closeURI

    Sleep CLOSE_WAIT
}

ToolTip
processed := files.Length - errors.Length
summary := "Done.`nProcessed : " processed "`nSkipped  : " skipped "`nErrors   : " errors.Length
if errors.Length > 0 {
    summary .= "`n`nFailed files:`n"
    for e in errors
        summary .= "  • " e "`n"
}
MsgBox summary, "Upload Complete", "Icon!"
ExitApp

; ============================================================
; URI encode — preserve / for path separators
; ============================================================
UriEncode(str) {
    static safe := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~/"
    out := ""
    loop parse, str {
        c := A_LoopField
        if InStr(safe, c)
            out .= c
        else
            out .= "%" Format("{:02X}", Ord(c))
    }
    return out
}
