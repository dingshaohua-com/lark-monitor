import asyncio
import logging
from datetime import date, datetime, timedelta, timezone, time as dtime

logger = logging.getLogger(__name__)

_task: asyncio.Task | None = None


async def _wait_until(target: dtime) -> None:
    """睡眠到当天或次日的 target 时刻（UTC+8）。"""
    tz = timezone(timedelta(hours=8))
    now = datetime.now(tz)
    next_run = datetime.combine(now.date(), target, tzinfo=tz)
    if next_run <= now:
        next_run += timedelta(days=1)
    delta = (next_run - now).total_seconds()
    logger.info("定时同步: 下次执行时间 %s (%.0f 秒后)", next_run.isoformat(), delta)
    await asyncio.sleep(delta)


async def _sync_recent_days():
    """同步近 3 天数据"""
    from server.service.opt_msg import sync

    today = date.today()
    start = today - timedelta(days=2)
    end = today
    logger.info("定时同步: 开始同步 %s ~ %s", start, end)
    try:
        await sync(start, end)
        logger.info("定时同步: 完成")
    except Exception:
        logger.exception("定时同步: 执行失败")


async def _scheduler_loop():
    """每天 00:01 (UTC+8) 自动同步"""
    target = dtime(0, 1)
    while True:
        await _wait_until(target)
        await _sync_recent_days()


def start_scheduler():
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_scheduler_loop())
        logger.info("定时同步调度器已启动")


def stop_scheduler():
    global _task
    if _task and not _task.done():
        _task.cancel()
        logger.info("定时同步调度器已停止")
    _task = None
