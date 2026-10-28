from django.shortcuts import render

# Create your views here.
# pages/views.py —— 後端：負責「提供頁面」和「提供課表資料」
import random

from django.http import JsonResponse

# ── 基本設定資料（想改內容就改這裡）──────────────────────────
DAYS = ["週一", "週二", "週三", "週四", "週五"]

# 每一節課的 (開始, 結束) 時間，共 7 節；第 4 節和第 5 節之間是午休
PERIODS = [
    ("08:10", "09:00"), ("09:10", "10:00"), ("10:10", "11:00"), ("11:10", "12:00"),
    ("13:10", "14:00"), ("14:10", "15:00"), ("15:10", "16:00"),
]

# 左側四個下拉選單的選項；每個清單的第一個會是預設值
OPTIONS = {
    "year": ["113", "114", "115"],
    "semester": ["上學期", "下學期"],
    "dept": ["資訊工程學系", "企業管理學系", "外國語文學系", "電機工程學系"],
    "grade": ["一年級", "二年級", "三年級", "四年級"],
}

# 各系所的課程名稱池，隨機排課時從裡面抽
COURSES = {
    "資訊工程學系": ["資料結構", "演算法", "作業系統", "計算機網路", "資料庫系統", "軟體工程", "機器學習", "Java 程式設計", "離散數學"],
    "企業管理學系": ["管理學", "會計學", "行銷管理", "財務管理", "組織行為", "經濟學", "人力資源管理", "ESG 與公司治理", "統計學"],
    "外國語文學系": ["英語聽講", "英美文學導讀", "語言學概論", "翻譯理論", "日語會話", "寫作與修辭", "跨文化溝通", "英語教學法", "西洋文學史"],
    "電機工程學系": ["電路學", "電磁學", "訊號與系統", "數位邏輯", "微處理機", "控制系統", "電子學", "通訊原理", "工程數學"],
}
TEACHERS = ["王大明", "林雅婷", "陳志豪", "張心怡", "李建宏", "黃怡君", "吳承恩", "劉佳穎"]
BUILDINGS = ["理學院", "工學院", "管理大樓", "語言中心", "綜合大樓"]
NOTICES = [
    "上課請提前 10 分鐘進教室，並完成電子點名。",
    "本週實驗課請攜帶學生證與筆電。",
    "期中考週課程調整，請留意信箱公告。",
    "教室內請保持安靜，手機轉為靜音。",
    "作業請於每週日 23:59 前上傳至課程平台。",
    "體育課請穿著運動服裝與運動鞋。",
    "停修申請將於第 9 週截止，請把握時間。",
    "課堂討論請事先閱讀指定教材。",
]


def _build_courses(rng, dept):
    """隨機排課。

    用一張 7 列 x 5 欄的表 occupied 記錄「哪一格已經有課」，
    每門課先隨機挑星期和起始節次，檢查沒衝突才放下去，避免課程重疊。
    """
    occupied = [[False] * len(DAYS) for _ in PERIODS]
    names = rng.sample(COURSES[dept], k=rng.randint(7, 9))  # 抽 7~9 門不重複的課
    result = []
    for name in names:
        span = rng.choice([2, 2, 3])      # 連續上幾節（2 節的機率較高）
        for _ in range(60):               # 最多嘗試 60 次，放不下就跳過這門課
            day = rng.randrange(len(DAYS))
            start = rng.randrange(len(PERIODS) - span + 1)
            if start < 4 < start + span:  # 跨過午休就重抽
                continue
            if any(occupied[start + i][day] for i in range(span)):  # 該時段已有課
                continue
            for i in range(span):         # 把這幾格標記為已占用
                occupied[start + i][day] = True
            result.append({
                "name": name,
                "teacher": rng.choice(TEACHERS),
                "room": f"{rng.choice(BUILDINGS)} {rng.randint(1, 5)}0{rng.randint(1, 9)}",
                "day": day,               # 0=週一 … 4=週五
                "start": start,           # 起始節次（從 0 開始）
                "span": span,             # 連續幾節
                "time": f"{DAYS[day]} {PERIODS[start][0]}–{PERIODS[start + span - 1][1]}",
            })
            break
    return result


def schedule_page(request):
    """回傳 HTML 頁面，並把下拉選項傳給範本使用。"""
    return render(request, "pages/schedule.html", {"options": OPTIONS})


def schedule_api(request):
    """回傳 JSON：前端按「篩選」時會呼叫這支，拿到課表和注意事項。"""
    # 讀取網址上的 ?year=...&dept=...；沒帶就用各清單的第一個當預設
    p = {k: request.GET.get(k) or v[0] for k, v in OPTIONS.items()}
    # 用篩選條件當隨機種子：條件相同 → 課表相同；條件改變 → 課表重新生成
    rng = random.Random("|".join(p.values()))
    return JsonResponse({
        "days": DAYS,
        "periods": [{"label": f"第{i + 1}節", "start": s, "end": e} for i, (s, e) in enumerate(PERIODS)],
        "courses": _build_courses(rng, p["dept"]),
        "notices": rng.sample(NOTICES, k=6),
    })