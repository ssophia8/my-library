#!/usr/bin/env python3
"""Claude Code の PreToolUse フック：literatures/ の中身を Claude に読ませない。

literatures/ には文芸誌の中身（表紙の絵・書名・作品）が入っていて、Git の管理外です。
Claude が読んでよいのは literatures/sample/（文例）だけです。

- Read / Write / Edit / NotebookEdit / Grep / Glob … 対象の場所が literatures/（sample 以外）なら止める
- Bash … コマンドの中で literatures/（sample 以外）を指していたら止める
  （文字列で見ているだけの目安です。確実に止めたいときは sandbox を使ってください）

settings.json の permissions.deny（Read(/literatures/*.*)）と組みにして使います。
deny は「sample だけ除く」を書けないので literatures/ 直下のファイルしか守れません。
その外側（literatures/ の中のフォルダや、シェルからの読み取り）をこのフックで埋めています。
"""
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__))))
PRIVATE = os.path.join(REPO, "literatures")
SAMPLE = os.path.join(PRIVATE, "sample")
REASON = ("literatures/ の中身（作品・表紙など）は読まない約束です。"
          "読めるのは literatures/sample/ の文例だけです。")


def deny(reason=REASON):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }, ensure_ascii=False))
    sys.exit(0)


def inside(path, root):
    return path == root or path.startswith(root + os.sep)


def is_private(path, cwd):
    if not path:
        return False
    full = os.path.realpath(os.path.join(cwd, os.path.expanduser(str(path))))
    return inside(full, PRIVATE) and not inside(full, SAMPLE)


# 「literatures」という名前のフォルダを指しているところ（guard-literatures.py などは数えない）
FOLDER = re.compile(r"(?<![\w.-])literatures(?![\w.-])")


def mentions_private(text):
    """文字列の中で literatures/ を指していて、そのあとが /sample ではないものがあるか"""
    text = str(text or "")
    found = list(FOLDER.finditer(text))
    if found and ".." in text:
        return True
    for match in found:
        if not re.match(r"/sample(/|[\s'\"]|$)", text[match.end():]):
            return True
    return False


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except ValueError:
        # 読めない入力のときは、literatures に触れていそうなら止める
        if "literatures" in raw:
            deny()
        return

    tool = data.get("tool_name", "")
    args = data.get("tool_input") or {}
    cwd = data.get("cwd") or os.getcwd()

    if tool in ("Read", "Write", "Edit", "NotebookEdit"):
        if is_private(args.get("file_path") or args.get("notebook_path"), cwd):
            deny()
    elif tool == "Grep":
        if is_private(args.get("path"), cwd) or mentions_private(args.get("glob")):
            deny()
    elif tool == "Glob":
        if is_private(args.get("path"), cwd) or mentions_private(args.get("pattern")):
            deny()
    elif tool == "Bash":
        full_cwd = os.path.realpath(cwd)
        if inside(full_cwd, PRIVATE) and not inside(full_cwd, SAMPLE):
            deny()
        if inside(full_cwd, SAMPLE) and ".." in args.get("command", ""):
            deny()
        if mentions_private(args.get("command")):
            deny(REASON + "（コマンドの中で literatures/ を指しています）")


if __name__ == "__main__":
    main()
