import json
from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.html import escape
from django.views import View
from rest_framework import generics, permissions
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .models import Car, CarImage, Review, Seller, SellerBanner
from .serializers import (
    DashboardCarSerializer,
    DashboardSellerSerializer,
    PublicCarSerializer,
    ReviewSerializer,
    SellerSerializer,
    SoldCarSerializer,
)


# ---------- Public: what buyers can see ----------
class PublicSellerView(generics.RetrieveAPIView):
    queryset = Seller.objects.prefetch_related("banners", "reviews")
    serializer_class = SellerSerializer
    lookup_field = "slug"
    permission_classes = [permissions.AllowAny]


class PublicCarListView(generics.ListAPIView):
    serializer_class = PublicCarSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        seller = get_object_or_404(Seller, slug=self.kwargs["slug"])
        # Sold cars are hidden from the public site
        return seller.cars.exclude(status=Car.Status.SOLD).prefetch_related("photos")


RECENTLY_SOLD_DAYS = 90  # how long a sold car stays in "Recently sold"


class PublicSoldListView(generics.ListAPIView):
    """Cars sold in the last few months, for the "Recently sold" section."""

    serializer_class = SoldCarSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        seller = get_object_or_404(Seller, slug=self.kwargs["slug"])
        cutoff = timezone.now() - timedelta(days=RECENTLY_SOLD_DAYS)
        return (
            seller.cars.filter(status=Car.Status.SOLD)
            .filter(Q(sold_at__gte=cutoff) | Q(sold_at__isnull=True))
            .order_by("-sold_at", "-id")
            .prefetch_related("photos")[:8]
        )


# ---------- The link dealers share on WhatsApp, Facebook, Instagram ----------
class ShareCarView(View):
    """Chat apps read the car's photo, name and price from this page to build a
    preview card. People who open the link are sent straight on to the car's
    page on the website."""

    def get(self, request, slug, stock):
        site = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
        seller = get_object_or_404(Seller, slug=slug)
        car = (
            seller.cars.exclude(status=Car.Status.SOLD)
            .filter(stock_number=stock)
            .first()
        )
        if car is None:
            return HttpResponseRedirect(site)  # sold or removed: show the website

        title = f"{car.year} {car.make} {car.model}"
        price = f"{seller.currency_symbol}{car.price:,.0f}"
        description = (
            f"{price} · {car.mileage:,} {seller.distance_unit} · "
            f"{car.get_condition_display()} · {seller.name}"
        )

        cover = car.image
        if not cover:
            first = car.photos.first()
            cover = first.image if first else None
        image_tag = ""
        if cover:
            image_url = request.build_absolute_uri(cover.url)
            image_tag = f'<meta property="og:image" content="{escape(image_url)}">'

        target = f"{site}/cars/{quote(stock, safe='')}"
        script_target = json.dumps(target).replace("</", "<\\/")

        page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{escape(title)} | {escape(seller.name)}</title>
<meta name="description" content="{escape(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{escape(seller.name)}">
<meta property="og:title" content="{escape(title)}">
<meta property="og:description" content="{escape(description)}">
<meta property="og:url" content="{escape(target)}">
{image_tag}
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url={escape(target)}">
</head>
<body>
<p>Opening {escape(title)}... <a href="{escape(target)}">Tap here if nothing happens</a>.</p>
<script>window.location.replace({script_target});</script>
</body>
</html>"""
        return HttpResponse(page)


# ---------- Login ----------
class LoginThrottle(AnonRateThrottle):
    """Slows down password guessing: 10 login attempts a minute per address."""

    scope = "login"

    def get_rate(self):
        return "10/min"


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        user = authenticate(
            username=request.data.get("username"),
            password=request.data.get("password"),
        )
        if user is None or not hasattr(user, "seller"):
            return Response({"detail": "Wrong username or password."}, status=400)
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "seller": SellerSerializer(user.seller).data}
        )


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        request.user.auth_token.delete()
        return Response(status=204)


# ---------- Dealer dashboard: only the logged-in dealer's own data ----------
class IsDealer(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and hasattr(request.user, "seller")


class ChangePasswordView(APIView):
    permission_classes = [IsDealer]

    def post(self, request):
        current = request.data.get("current_password", "")
        new = request.data.get("new_password", "")
        user = request.user

        if not user.check_password(current):
            return Response(
                {"current_password": ["That isn't your current password."]},
                status=400,
            )
        try:
            validate_password(new, user)
        except DjangoValidationError as error:
            return Response({"new_password": list(error.messages)}, status=400)

        user.set_password(new)
        user.save()
        # Old logins stop working, so hand back a fresh token
        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)
        return Response({"token": token.key})


class DashboardCarListCreate(generics.ListCreateAPIView):
    serializer_class = DashboardCarSerializer
    permission_classes = [IsDealer]

    def get_queryset(self):
        return self.request.user.seller.cars.prefetch_related("photos")

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user.seller)


class DashboardCarDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DashboardCarSerializer
    permission_classes = [IsDealer]

    def get_queryset(self):
        # Another dealer's car simply comes back as "not found"
        return self.request.user.seller.cars.prefetch_related("photos")


class DashboardCarPhotoDelete(APIView):
    """Removes one extra photo from one of the dealer's own cars."""

    permission_classes = [IsDealer]

    def delete(self, request, car_id, photo_id):
        photo = get_object_or_404(
            CarImage, pk=photo_id, car_id=car_id, car__seller=request.user.seller
        )
        photo.image.delete(save=False)  # remove the file from disk as well
        photo.delete()
        return Response(status=204)


class DashboardReviewListCreate(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [IsDealer]

    def get_queryset(self):
        return self.request.user.seller.reviews.all()

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user.seller)


class DashboardReviewDelete(generics.DestroyAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [IsDealer]

    def get_queryset(self):
        return self.request.user.seller.reviews.all()


class DashboardBannerDelete(APIView):
    """Removes one banner photo from the dealer's own home page."""

    permission_classes = [IsDealer]

    def delete(self, request, banner_id):
        banner = get_object_or_404(
            SellerBanner, pk=banner_id, seller=request.user.seller
        )
        banner.image.delete(save=False)  # remove the file from disk as well
        banner.delete()
        return Response(status=204)


class DashboardSellerView(generics.RetrieveUpdateAPIView):
    serializer_class = DashboardSellerSerializer
    permission_classes = [IsDealer]

    def get_object(self):
        return self.request.user.seller