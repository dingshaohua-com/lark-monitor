"""
工单内容分类工具。

根据回复文本中的关键词，将工单分为「技术问题」「非技术问题」「待定」。
后续如需新增分类维度（如按业务线、按客户端等），在此文件中扩展即可。
"""

import re

# ── 关键词表（按需增删）──────────────────────────────────

TECH_KEYWORDS = [
    "修复", "已修复", "上线", "已上线",
    "bug", "BUG", "Bug",
    "排查", "定位", "查到", "找到问题",
    "代码", "配置", "部署",
    "数据库", "接口", "日志",
    "已解决", "会解决", "今天会修复",
    "添加补丁", "已恢复",
]

NON_TECH_KEYWORDS = [
    "网络问题", "网络较差", "网络不佳", "网络卡顿",
    "用户操作", "学生操作",
    "正常现象", "设计如此", "没问题",
    "印刷体", "审核未通过",
    "非技术问题",
    "建议", "更换网络", "重试",
    "无效工单", "可以关闭", "可以关了",
]

PENDING_KEYWORDS = [
    "收到", "看一下", "看下", "辛苦",
    "排查中", "跟进中", "处理中",
    "麻烦", "提供", "确认",
    "我看看", "我查", "在看",
]


# ── 文本提取 ─────────────────────────────────────────────

def extract_reply_text(reply: dict) -> str:
    """从回复文档中提取纯文本（兼容 HTML 字符串、dict、纯字符串）"""
    parsed = reply.get("ext", {}).get("parsedContent")
    if isinstance(parsed, dict):
        return parsed.get("text", "")
    if isinstance(parsed, str):
        return re.sub(r"<[^>]+>", "", parsed)
    return ""


# ── 分类函数 ─────────────────────────────────────────────

def classify_issue_type(replies: list[dict]) -> str:
    """根据回复内容关键词判断工单类型：技术问题 / 非技术问题 / 待定"""
    if not replies:
        return "待定"

    texts = [extract_reply_text(r) for r in replies]
    all_text = " ".join(texts)

    if "非技术问题" in all_text:
        return "非技术问题"

    tech = sum(1 for kw in TECH_KEYWORDS if kw in all_text)
    non_tech = sum(1 for kw in NON_TECH_KEYWORDS if kw in all_text)

    if tech > 0 and tech > non_tech:
        return "技术问题"
    if non_tech > 0 and non_tech > tech:
        return "非技术问题"
    if tech == non_tech and tech > 0:
        last = texts[-1] if texts else ""
        for kw in TECH_KEYWORDS:
            if kw in last:
                return "技术问题"
        for kw in NON_TECH_KEYWORDS:
            if kw in last:
                return "非技术问题"

    return "待定"
