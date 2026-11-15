from django.db import transaction
from rest_framework import serializers

from .models import (
    MAX_BANNERS,
    MAX_EXTRA_PHOTOS,
    Car,
    CarImage,
    Review,
    Seller,
    SellerBanner,
)

CAR_PUBLIC_FIELDS = [
    "id", "stock_number", "vin", "make", "model", "year", "condition", "mileage",
    "engine", "horsepower", "drive", "transmission", "fuel", "location",
    "image", "photos", "price", "is_negotiable", "status", "is_featured",
]


SELLER_FIELDS = [
    "name", "slug", "tagline", "about", "email", "phone", "whatsapp",
    "address", "hours", "currency_symbol", "distance_unit", "brands",
    "headline", "intro", "logo", "banners",
    "instagram", "website", "map_query", "reviews",
]


class BannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = SellerBanner
        fields = ["id", "image"]


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ["id", "author", "rating", "text", "car_name", "created_at"]
        read_only_fields = ["id", "created_at"]


class SellerSerializer(serializers.ModelSerializer):
    """What buyers see about a seller, including the branding."""

    banners = BannerSerializer(many=True, read_only=True)
    reviews = serializers.SerializerMethodField()

    def get_reviews(self, seller):
        newest = list(seller.reviews.all())[:12]
        return ReviewSerializer(newest, many=True).data

    class Meta:
        model = Seller
        fields = SELLER_FIELDS
        read_only_fields = ["slug", "logo"]


class DashboardSellerSerializer(SellerSerializer):
    """What the dealer edits, including his logo and banner photos."""

    remove_logo = serializers.BooleanField(write_only=True, required=False)
    uploaded_banners = serializers.ListField(
        child=serializers.ImageField(), write_only=True, required=False
    )

    class Meta(SellerSerializer.Meta):
        fields = SELLER_FIELDS + ["remove_logo", "uploaded_banners"]
        read_only_fields = ["slug"]

    def validate_uploaded_banners(self, files):
        already = self.instance.banners.count() if self.instance else 0
        if already + len(files) > MAX_BANNERS:
            room = max(MAX_BANNERS - already, 0)
            raise serializers.ValidationError(
                f"You can have up to {MAX_BANNERS} banner photos. "
                f"You can add {room} more."
            )
        return files

    @transaction.atomic
    def update(self, instance, validated_data):
        files = validated_data.pop("uploaded_banners", [])
        remove_logo = validated_data.pop("remove_logo", False)
        if remove_logo and "logo" not in validated_data:
            if instance.logo:
                instance.logo.delete(save=False)
            validated_data["logo"] = ""
        seller = super().update(instance, validated_data)
        start = seller.banners.count()
        for index, file in enumerate(files):
            SellerBanner.objects.create(
                seller=seller, image=file, position=start + index
            )
        return seller


class CarImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CarImage
        fields = ["id", "image"]


class PublicCarSerializer(serializers.ModelSerializer):
    """What buyers see. It never includes min_price."""

    photos = CarImageSerializer(many=True, read_only=True)

    class Meta:
        model = Car
        fields = CAR_PUBLIC_FIELDS


class DashboardCarSerializer(PublicCarSerializer):
    """What the dealer sees and edits. Includes the private min_price."""

    # New extra photos arrive here, together with the rest of the car's details
    uploaded_photos = serializers.ListField(
        child=serializers.ImageField(), write_only=True, required=False
    )

    class Meta(PublicCarSerializer.Meta):
        fields = CAR_PUBLIC_FIELDS + ["min_price", "created_at", "uploaded_photos"]
        read_only_fields = ["id", "created_at"]

    def validate_vin(self, value):
        return value.strip().upper()

    def validate_stock_number(self, value):
        seller = self.context["request"].user.seller
        others = Car.objects.filter(seller=seller, stock_number=value)
        if self.instance:
            others = others.exclude(pk=self.instance.pk)
        if others.exists():
            raise serializers.ValidationError(
                "You already have a car with this stock number."
            )
        return value

    def validate_uploaded_photos(self, files):
        already = self.instance.photos.count() if self.instance else 0
        if already + len(files) > MAX_EXTRA_PHOTOS:
            room = max(MAX_EXTRA_PHOTOS - already, 0)
            raise serializers.ValidationError(
                f"A car can have up to {MAX_EXTRA_PHOTOS} extra photos. "
                f"You can add {room} more."
            )
        return files

    def validate(self, data):
        price = data.get("price", getattr(self.instance, "price", None))
        min_price = data.get("min_price", getattr(self.instance, "min_price", None))
        if price is not None and min_price is not None and min_price > price:
            raise serializers.ValidationError(
                {"min_price": "The minimum price can't be higher than the price."}
            )
        return data

    @transaction.atomic
    def create(self, validated_data):
        files = validated_data.pop("uploaded_photos", [])
        car = super().create(validated_data)
        self._add_photos(car, files)
        return car

    @transaction.atomic
    def update(self, instance, validated_data):
        files = validated_data.pop("uploaded_photos", [])
        car = super().update(instance, validated_data)
        self._add_photos(car, files)
        return car

    def _add_photos(self, car, files):
        start = car.photos.count()
        for index, file in enumerate(files):
            CarImage.objects.create(car=car, image=file, position=start + index)


class SoldCarSerializer(serializers.ModelSerializer):
    """A sold car for the "Recently sold" section: no price, just the car."""

    image = serializers.SerializerMethodField()

    class Meta:
        model = Car
        fields = ["id", "make", "model", "year", "sold_at", "image"]

    def get_image(self, car):
        cover = car.image
        if not cover:
            photos = list(car.photos.all())
            cover = photos[0].image if photos else None
        if not cover:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(cover.url) if request else cover.url