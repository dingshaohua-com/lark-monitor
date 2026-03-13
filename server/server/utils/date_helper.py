from datetime import date, datetime, time, timezone

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