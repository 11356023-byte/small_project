# pages/urls.py —— 這個 app 自己的路由表（新增檔案）
from django.urls import path
 
from . import views
 
urlpatterns = [
    path("", views.schedule_page, name="schedule"),                    # 網址 /  → 顯示頁面
    path("api/schedule/", views.schedule_api, name="schedule-api"),    # 網址 /api/schedule/ → 回傳 JSON
]