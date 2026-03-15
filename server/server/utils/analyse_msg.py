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
    从飞书 post content 中提取纯文本字符串
    :param content_data: 传入的 content 字段 (列表或 JSON 字符串)
    """
    # 1. 结构兼容性处理
    if isinstance(content_data, str):
        try:
            temp_data = json.loads(content_data)
            # 自动探测是整个 body 还是 content 数组
            content_list = temp_data.get("content", temp_data)
        except:
            return content_data
    else:
        content_list = content_data

    if not isinstance(content_list, list):
        return str(content_data)

    text_lines = []

    # 2. 遍历每一行 (Row)
    for row in content_list:
        row_pieces = []

        for item in row:
            tag = item.get("tag")

            # --- 文本 & 超链接：直接取文字内容 ---
            if tag in ["text", "a"]:
                row_pieces.append(item.get("text", ""))

            # --- 图片：替换为占位文本 ---
            # elif tag == "img":
            #     row_pieces.append("[图片暂不支持在此预览]")

            # --- @ 提到某人 ---
            elif tag == "at":
                row_pieces.append(f"@{item.get('user_name', '用户')}")

        # 将这一行内部的碎片拼接
        combined_row = "".join(row_pieces).strip()

        # 只有当这一行不为空时才加入列表
        if combined_row:
            text_lines.append(combined_row)

    # 3. 使用换行符连接所有行
    return "\n".join(text_lines)



