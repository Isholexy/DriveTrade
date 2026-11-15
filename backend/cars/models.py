from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from PIL import Image, ImageOps

MAX_PHOTO_SIDE = 1600  # longest side of a stored photo, in pixels
MAX_EXTRA_PHOTOS = 15  # extra photos allowed per car (besides the main photo)
MAX_BANNERS = 6  # banner photos allowed on a seller's home page


def shrink_photo(field_file, max_side=MAX_PHOTO_SIDE, as_png=False):
    """Shrinks a newly uploaded image so pages stay fast.

    Phone photos are often 4 to 8 MB. This keeps them sharp but much smaller.
    Logos (as_png=True) stay PNG so a transparent background is kept.
    It only runs when a new image was just uploaded."""
    if not field_file or field_file._committed:
        return

    image = Image.open(field_file)
    image = ImageOps.exif_transpose(image)  # keep phone photos the right way up
    image.thumbnail((max_side, max_side))

    buffer = BytesIO()
    if as_png:
        image.convert("RGBA").save(buffer, format="PNG", optimize=True)
        extension = ".png"
    else:
        if image.mode in ("RGBA", "LA", "P"):
            # Transparent areas become white instead of black
            image = image.convert("RGBA")
            background = Image.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[-1])
            image = background
        elif image.mode != "RGB":
            image = image.convert("RGB")
        image.save(buffer, format="JPEG", quality=82, optimize=True)
        extension = ".jpg"

    new_name = field_file.name.rsplit(".", 1)[0] + extension
    field_file.save(new_name, ContentFile(buffer.getvalue()), save=False)


class Seller(models.Model):
    """One dealership. Each seller has their own page and their own cars."""

    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="seller"
    )
    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    tagline = models.CharField(max_length=200, blank=True)
    about = models.TextField(blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    whatsapp = models.CharField(
        max_length=20, blank=True, help_text="Digits only, with country code"
    )
    address = models.CharField(max_length=200, blank=True)
    hours = models.CharField(max_length=120, blank=True)
    currency_symbol = models.CharField(max_length=5, default="$")
    distance_unit = models.CharField(
        max_length=2, choices=[("mi", "mi"), ("km", "km")], default="mi"
    )
    brands = models.CharField(
        max_length=300,
        blank=True,
        help_text="Brands this dealer sells, separated by commas. Example: Toyota, Honda, Mercedes-Benz",
    )
    # Branding for the public website
    logo = models.ImageField(upload_to="branding/", blank=True)
    headline = models.CharField(
        max_length=120,
        blank=True,
        help_text="The big line on the home page. Leave empty to use the default.",
    )
    intro = models.CharField(
        max_length=300,
        blank=True,
        help_text="The short text under the headline on the home page.",
    )
    # Links and details shown on the website and on the share images
    instagram = models.CharField(
        max_length=40, blank=True, help_text="Instagram handle, for example drivetrade"
    )
    website = models.CharField(
        max_length=100, blank=True, help_text="Web address to show on share images, for example drivetrade.com"
    )
    map_query = models.CharField(
        max_length=200,
        blank=True,
        help_text="What to search for on the map. Leave empty to use the address.",
    )

    def save(self, *args, **kwargs):
        shrink_photo(self.logo, max_side=600, as_png=True)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class SellerBanner(models.Model):
    """A big photo that rotates at the top of the seller's home page."""

    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name="banners")
    image = models.ImageField(upload_to="branding/")
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def save(self, *args, **kwargs):
        shrink_photo(self.image, max_side=2000)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Banner {self.position + 1} of {self.seller}"


class Car(models.Model):
    class Condition(models.TextChoices):
        NEW = "Brand New", "Brand new"
        CERTIFIED = "Certified", "Certified pre-owned"
        USED = "Pre-Owned", "Pre-owned"

    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        RESERVED = "reserved", "Reserved"
        SOLD = "sold", "Sold"

    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name="cars")
    stock_number = models.CharField(max_length=20)
    vin = models.CharField(
        "VIN / chassis number",
        max_length=17,
        blank=True,
        help_text="Usually 17 characters. Older or imported cars may have a shorter chassis number.",
    )
    make = models.CharField(max_length=60)
    model = models.CharField(max_length=80)
    year = models.PositiveSmallIntegerField()
    condition = models.CharField(max_length=20, choices=Condition.choices)
    mileage = models.PositiveIntegerField()
    engine = models.CharField(max_length=80, blank=True)
    horsepower = models.PositiveIntegerField(null=True, blank=True)
    drive = models.CharField(max_length=10, blank=True, help_text="e.g. RWD, FWD, AWD")
    transmission = models.CharField(max_length=60, blank=True)
    fuel = models.CharField(max_length=30, blank=True)
    location = models.CharField(max_length=100, blank=True)
    # The main photo, shown on the cards. More photos are in CarImage below.
    image = models.ImageField(upload_to="cars/", blank=True)

    price = models.DecimalField(max_digits=12, decimal_places=2)
    is_negotiable = models.BooleanField(default=False)
    # PRIVATE: the lowest price the seller would accept. Never send this to buyers.
    min_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )

    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.AVAILABLE
    )
    is_featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    # Filled in automatically when the car is marked as sold
    sold_at = models.DateTimeField(null=True, blank=True, editable=False)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["seller", "stock_number"],
                name="unique_stock_number_per_seller",
            )
        ]

    def save(self, *args, **kwargs):
        shrink_photo(self.image)
        if self.status == self.Status.SOLD:
            if self.sold_at is None:
                self.sold_at = timezone.now()
        else:
            self.sold_at = None
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.year} {self.make} {self.model}"


class CarImage(models.Model):
    """An extra photo of a car (rear, interior, engine, and so on)."""

    car = models.ForeignKey(Car, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="cars/")
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def save(self, *args, **kwargs):
        shrink_photo(self.image)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Photo {self.position + 1} of {self.car}"


class Review(models.Model):
    """A customer review the dealer shows on his home page."""

    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name="reviews")
    author = models.CharField(max_length=80)
    rating = models.PositiveSmallIntegerField(
        default=5, validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    text = models.CharField(max_length=400)
    car_name = models.CharField(
        max_length=120, blank=True, help_text="Optional, for example 2019 Toyota Camry"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.author} ({self.rating} stars)"