import re
import json
from server.utils.dict_registry import get as get_registry

def convert_work_order_content(text: str) -> dict[str, str]:
    """将工单格式的文本解析为 {key: value, ...}。"""
    work_order_map = get_registry("work_order_map") or {}
    result = {}
    # 格式: 【标签】：值，每行一条
    pattern = re.compile(r"【([^】]+)】：(.*?)(?=\n【|$)", re.DOTALL)
    for label, value in pattern.findall(text):
        value = value.strip().rstrip("\n")
        key = work_order_map.get(label, label)
        result[key] = value
    return result


def convert_reply_post_to_html(content_data):
    """
    将飞书 post content 数组转为 HTML 富文本
    :param content_data: 传入的 content 字段 (列表或 JSON 字符串)
    """
    # 1. 如果传入的是字符串，先转为 Python 列表
    if isinstance(content_data, str):
        try:
            # 兼容：有些地方传的是整个 body 对象，有些地方只传 content 数组
            temp_data = json.loads(content_data)
            content_list = temp_data.get("content", temp_data)
        except:
            return content_data
    else:
        content_list = content_data

    if not isinstance(content_list, list):
        return ""

    html_result = []

    # 2. 遍历每一行 (Row)
    for row in content_list:
        line_buffer = []

        for item in row:
            tag = item.get("tag")

            # --- 文本：处理样式叠加 ---
            if tag == "text":
                text = item.get("text", "").replace("\n", "<br>")
                styles = item.get("style", [])
                if "bold" in styles: text = f"<b>{text}</b>"
                if "underline" in styles: text = f"<u>{text}</u>"
                if "italic" in styles: text = f"<i>{text}</i>"
                if "strikethrough" in styles: text = f"<s>{text}</s>"
                line_buffer.append(text)

            # --- 超链接 ---
            elif tag == "a":
                href = item.get("href", "")
                text = item.get("text", "")
                line_buffer.append(f"<a href='{href}' target='_blank' style='color:#3370ff;'>{text}</a>")

            # --- 图片：替换为文本提示 ---
            elif tag == "img":
                line_buffer.append("<span style='color: #999; font-style: italic;'> [图片暂不支持在此预览] </span>")

            # --- @ 提到某人 ---
            elif tag == "at":
                user_name = item.get("user_name", "用户")
                line_buffer.append(f"<span style='color:#3370ff;'>@{user_name}</span>")

        # 拼接行，并包裹在 p 标签中
        if line_buffer:
            html_result.append(f"<p style='margin: 0.4em 0;'>{''.join(line_buffer)}</p>")

    return "".join(html_result)


def extract_msg_text(content_data):
    """
    从飞书 post / interactive elements 结构中提取纯文本
    :param content_data: content 行数组、JSON 字符串、或含 content 键的 dict
    """
    if isinstance(content_data, str):
        try:
            temp_data = json.loads(content_data)
            content_list = temp_data.get("content", temp_data)
        except Exception:
            return content_data
    elif isinstance(content_data, dict):
        content_list = content_data.get("content", content_data)
    else:
        content_list = content_data

    if not isinstance(content_list, list):
        return ""

    text_lines = []

    for row in content_list:
        if not isinstance(row, list):
            continue
        row_pieces = []

        for item in row:
            if not isinstance(item, dict):
                continue
            tag = item.get("tag")

            if tag in ["text", "a"]:
                row_pieces.append(item.get("text", ""))
            elif tag == "img":
                row_pieces.append("[视频/媒体]")
            elif tag == "at":
                row_pieces.append(f"@{item.get('user_name', '用户')}")

        combined_row = "".join(row_pieces).strip()
        if combined_row:
            text_lines.append(combined_row)

    return "\n".join(text_lines)


def _prepend_mention_keys(reply: dict, text: str) -> str:
    """
    飞书纯文本里 @ 可能只出现在消息级 mentions，而不在 body.text 里。
    若正文尚未包含任一 mention.key（如 @_user_1），则在前面补上（多个人每人一行）。
    """
    text = (text or "").strip()
    mentions = reply.get("mentions")
    if not isinstance(mentions, list) or not mentions:
        return text
    keys: list[str] = []
    for m in mentions:
        if not isinstance(m, dict):
            continue
        k = (m.get("key") or "").strip()
        if k and k not in keys:
            keys.append(k)
    if not keys:
        return text
    if not text:
        return "\n".join(keys)
    if any(k in text for k in keys):
        return text
    return "\n".join(keys) + "\n" + text


def _is_auto_diagnosis_interactive(raw: dict) -> bool:
    """机器人「自动排查单」卡片，导出/上传时跳过。"""
    title = (raw.get("title") or "").strip()
    return title == "自动排查单" or title.startswith("自动排查单")


def extract_reply_document_text(reply: dict) -> str:
    """
    从回复文档提取展示用纯文本：优先 body.content 原始 JSON。
    纯文本消息保留飞书里的 @_user_1 等占位；post/interactive 结构化解析。
    """
    msg_type = reply.get("msg_type")
    body = reply.get("body") or {}
    content = body.get("content")

    raw = None
    if isinstance(content, str):
        s = content.strip()
        if s:
            try:
                raw = json.loads(s)
            except json.JSONDecodeError:
                raw = content
    elif isinstance(content, dict):
        raw = content

    if msg_type == "text" and isinstance(raw, dict):
        t = (raw.get("text") or "").strip()
        return _prepend_mention_keys(reply, t)
    if msg_type == "text" and isinstance(raw, str):
        return _prepend_mention_keys(reply, raw.strip())

    if msg_type == "post" and isinstance(raw, dict):
        parts = []
        title = (raw.get("title") or "").strip()
        if title:
            parts.append(title)
        c = raw.get("content")
        if isinstance(c, list):
            t = extract_msg_text(c)
            if t:
                parts.append(t)
        out = "\n".join(parts).strip()
        return _prepend_mention_keys(reply, out)

    if msg_type == "interactive" and isinstance(raw, dict):
        if _is_auto_diagnosis_interactive(raw):
            return ""
        parts = []
        title = (raw.get("title") or "").strip()
        if title:
            parts.append(title)
        elements = raw.get("elements")
        if isinstance(elements, list):
            t = extract_msg_text(elements)
            if t:
                parts.append(t)
        out = "\n".join(parts).strip()
        return _prepend_mention_keys(reply, out)

    parsed = reply.get("ext", {}).get("parsedContent")
    if isinstance(parsed, dict):
        return _prepend_mention_keys(reply, (parsed.get("text") or "").strip())
    if isinstance(parsed, str):
        plain = re.sub(r"<[^>]+>", "", parsed).strip()
        if plain.startswith("自动排查单"):
            return ""
        return _prepend_mention_keys(reply, plain)
    return ""



