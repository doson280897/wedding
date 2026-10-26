from PIL import Image, ImageOps

image = Image.open("assets/son-2.jpg")

# Lật ảnh trái ↔ phải
flipped = ImageOps.mirror(image)

# Lưu thành ảnh mới
flipped.save("assets/son-2-flipped.jpg", quality=95)
