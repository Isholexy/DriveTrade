from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from cars.views import ShareCarView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("cars.urls")),
    # The link dealers share. Chat apps read the car's preview from it.
    path("share/<slug:slug>/<str:stock>/", ShareCarView.as_view()),
]

if settings.DEBUG:
    # On your own computer
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
elif getattr(settings, "SERVE_MEDIA", False):
    # Online: Django serves the uploaded photos itself, so the flyer maker is
    # allowed to read them (the CORS settings apply to these responses too)
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    ]