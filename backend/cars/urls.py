from django.urls import path

from . import views

urlpatterns = [
    # Public (buyers)
    path("sellers/<slug:slug>/", views.PublicSellerView.as_view()),
    path("sellers/<slug:slug>/cars/", views.PublicCarListView.as_view()),
    path("sellers/<slug:slug>/sold/", views.PublicSoldListView.as_view()),
    # Login
    path("auth/login/", views.LoginView.as_view()),
    path("auth/logout/", views.LogoutView.as_view()),
    path("auth/change-password/", views.ChangePasswordView.as_view()),
    # Dealer dashboard
    path("dashboard/cars/", views.DashboardCarListCreate.as_view()),
    path("dashboard/cars/<int:pk>/", views.DashboardCarDetail.as_view()),
    path(
        "dashboard/cars/<int:car_id>/photos/<int:photo_id>/",
        views.DashboardCarPhotoDelete.as_view(),
    ),
    path(
        "dashboard/banners/<int:banner_id>/",
        views.DashboardBannerDelete.as_view(),
    ),
    path("dashboard/reviews/", views.DashboardReviewListCreate.as_view()),
    path("dashboard/reviews/<int:pk>/", views.DashboardReviewDelete.as_view()),
    path("dashboard/seller/", views.DashboardSellerView.as_view()),
]