from datetime import date, datetime, time, timedelta, timezone

def get_full_date_time(start_date: date | None, end_date: date | None = None, timestamp=False):
    """将日期范围转换为日期时间范围（含起止全天）"""
    if start_date is None:
        start_date = date.today()
    start = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end_date = end_date if end_date else start_date
    end = datetime.combine(end_date, time.max, tzinfo=timezone.utc)
    if timestamp:
        start = str(int(start.timestamp()))
        end = str(int(end.timestamp()))
    return start, end


def to_epoch_ms(date_str: str | None, *, end_of_day: bool = False) -> int | None:
    """将 YYYY-MM-DD 字符串转换为 UTC 毫秒时间戳。"""
    if not date_str:
        return None
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    if end_of_day:
        dt = dt + timedelta(days=1) - timedelta(milliseconds=1)
    return int(dt.timestamp() * 1000)


def get_date_range_epoch_ms(start_date: str | None, end_date: str | None = None) -> tuple[int | None, int | None]:
    """将开始/结束日期字符串转换为 UTC 毫秒时间戳范围。"""
    return to_epoch_ms(start_date), to_epoch_ms(end_date, end_of_day=True)