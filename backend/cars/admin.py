from django.contrib import admin

from .models import Car, CarImage, Review, Seller, SellerBanner


class SellerBannerInline(admin.TabularInline):
    model = SellerBanner
    extra = 1


@admin.register(Seller)
class SellerAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "owner")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [SellerBannerInline]


class CarImageInline(admin.TabularInline):
    model = CarImage
    extra = 1


@admin.register(Car)
class CarAdmin(admin.ModelAdmin):
    list_display = ("year", "make", "model", "price", "status", "seller")
    list_filter = ("status", "condition", "seller")
    search_fields = ("make", "model", "stock_number", "vin")
    inlines = [CarImageInline]
    readonly_fields = ("sold_at",)


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("author", "rating", "seller", "created_at")
    list_filter = ("seller", "rating")