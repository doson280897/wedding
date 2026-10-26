from PIL import Image, ImageOps

image = Image.open("assets/son-1.jpg")

# Lật ảnh trái ↔ phải
flipped = ImageOps.mirror(image)

# Lưu thành ảnh mới
flipped.save("assets/son-1-flipped.jpg", quality=95)
