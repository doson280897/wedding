/**
 * WEDDING INFORMATION — FILE DUY NHẤT CẦN SỬA KHI DÙNG TEMPLATE CHO CẶP ĐÔI KHÁC.
 *
 * 1. site: domain và thông tin khi chia sẻ thiệp.
 * 2. couple / families: tên, chữ cái viết tắt (ví dụ S & N), cha mẹ và địa chỉ.
 * 3. wedding.mode: "double" (nhà gái & nhà trai) hoặc "single" (một tiệc chung).
 *    Chọn "single": chỉ cần sửa parties.single (ngày/giờ/địa điểm/nhạc/ảnh/QR).
 *    Chọn "double": sửa parties.bride và parties.groom như hiện nay.
 * 4. Album ảnh: mode/shuffle/WebP/chú thích/danh sách ảnh đều nằm trong
 *    images/manifest.json; không khai báo album lặp trong file này.
 * 5. text.vi / text.en: chữ giao diện/lời mời, dùng {{duong.dan}}
 *    tham chiếu {{couple.groom.short}}, {{parties.bride.dateDots}}, v.v.
 * 6. site.introSound: đường dẫn tùy chọn tới một đoạn tiếng mở khóa/cổng.
 *    Để trống nếu chưa có file. Hiệu ứng này tách biệt với nhạc YouTube.
 *
 * Muốn đổi ảnh / QR / album: đặt file ảnh mới vào repository, rồi cập nhật đường dẫn ở đây.
 * Tuyệt đối không cần sửa index.html, script.js, i18n.js, link-tool.js, style.css.
 */
window.WEDDING_INFO = {
  "site": {
    "url": "https://doson280897.github.io/wedding/",
    "description": {
      "vi": "Trân trọng kính mời bạn tham dự ngày vui của chúng mình.",
      "en": "Join us for our wedding celebration."
    },
    "timezone": "+07:00",
    "socialImage": "og-preview.jpg",
    "introSound": "",
    "entrance": {
      "image": "images/optimized/assets/secret-garden-gate.webp",
      "lock": "images/optimized/assets/secret-garden-lock.webp"
    },
    "titlePrefix": {
      "vi": "Thiệp cưới",
      "en": "Wedding Invitation"
    }
  },
  "couple": {
    "bride": {
      "short": "Tố Nga",
      "full": "Lữ Thị Tố Nga",
      "initial": "N"
    },
    "groom": {
      "short": "Thành Sơn",
      "full": "Đỗ Ngọc Thành Sơn",
      "initial": "S"
    }
  },
  "families": {
    "bride": {
      "father": "Lữ Duy Mạnh",
      "mother": "Nguyễn Thị Hương",
      "address": {
        "vi": "144 Chu Văn An, Xã Krông Ana, Tỉnh Đắk Lắk",
        "en": "144 Chu Văn An Street, Krông Ana Commune, Đắk Lắk Province"
      }
    },
    "groom": {
      "father": "Đỗ Ngọc Thiện",
      "mother": "Lê Thị Thanh Trang",
      "address": {
        "vi": "Ấp Cao Cang, Xã Định Quán, Thành phố Đồng Nai",
        "en": "Cao Cang Hamlet, Định Quán Commune, Đồng Nai City"
      }
    }
  },
  "parties": {
    "bride": {
      "date": "2026-11-14",
      "ceremonyTime": "09:00",
      "ceremonyEnd": "10:00",
      "receptionTime": "11:00",
      "receptionEnd": "13:00",
      "city": {
        "vi": "Krông Ana, Đắk Lắk",
        "en": "Krông Ana, Đắk Lắk"
      },
      "lunar": {
        "vi": "Nhằm ngày 06 tháng 10 năm Bính Ngọ",
        "en": "6th day of the 10th lunar month, Year of the Fire Horse"
      },
      "home": {
        "address": {
          "vi": "{{families.bride.address}}",
          "en": "{{families.bride.address}}"
        }
      },
      "venue": {
        "name": {
          "vi": "Nhà Hàng Hương Lan",
          "en": "Hương Lan Restaurant"
        },
        "address": {
          "vi": "24 Hùng Vương, Krông Ana, Đắk Lắk",
          "en": "24 Hùng Vương Street, Krông Ana, Đắk Lắk"
        },
        "calendarAddress": {
          "vi": "{{parties.bride.venue.name}}, {{parties.bride.venue.address}}",
          "en": "{{parties.bride.venue.name}}, {{parties.bride.venue.address}}"
        },
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Nhà+Hàng+Hương+Lan+24+Hùng+Vương+Krông+Ana+Đắk+Lắk",
        "embedUrl": "https://maps.google.com/maps?q=24%20Hung%20Vuong%20Krong%20Ana%20Dak%20Lak&t=&z=15&ie=UTF8&iwloc=&output=embed"
      },
      "music": {
        "src": "audio/bride.mp3"
      },
      "images": {
        "hero": "images/optimized/assets/hero_bride.webp",
        "ending": "images/optimized/assets/ending_bride.webp",
        "favicon": "favicon-bride.svg",
        "portraitMain": "images/optimized/assets/nga-2.webp",
        "portraitSecondary": "images/optimized/assets/nga-1.webp"
      },
      "gift": {
        "bank": "MB",
        "accountHolder": "{{couple.bride.fullUpper}}",
        "accountNumber": "8789 3224 6384 9",
        "qrImage": "images/optimized/assets/gift-qr-bride.svg",
        "qrAlt": {
          "vi": "Mã QR {{parties.bride.gift.bank}} mừng cưới {{couple.bride.short}}",
          "en": "{{parties.bride.gift.bank}} wedding gift QR for {{couple.bride.short}}"
        }
      },
      "region": {
        "vi": "Đắk Lắk",
        "en": "Đắk Lắk"
      }
    },
    "groom": {
      "date": "2026-11-29",
      "ceremonyTime": "09:00",
      "ceremonyEnd": "10:00",
      "receptionTime": "11:00",
      "receptionEnd": "13:00",
      "city": {
        "vi": "Định Quán, Đồng Nai",
        "en": "Định Quán, Đồng Nai"
      },
      "lunar": {
        "vi": "Nhằm ngày 21 tháng 10 năm Bính Ngọ",
        "en": "21st day of the 10th lunar month, Year of the Fire Horse"
      },
      "home": {
        "address": {
          "vi": "{{families.groom.address}}",
          "en": "{{families.groom.address}}"
        }
      },
      "venue": {
        "name": {
          "vi": "Tư Gia Nhà Trai",
          "en": "Groom's Family Home"
        },
        "address": {
          "vi": "Ấp Cao Cang, Xã Định Quán, Thành phố Đồng Nai",
          "en": "Cao Cang Hamlet, Định Quán Commune, Đồng Nai City"
        },
        "calendarAddress": {
          "vi": "{{parties.groom.venue.address}}",
          "en": "{{parties.groom.venue.address}}"
        },
        "mapUrl": "https://www.google.com/maps/place/11%C2%B009'48.2%22N+107%C2%B023'24.5%22E/@11.163395,107.3875511,17z/",
        "embedUrl": "https://maps.google.com/maps?q=11.163389,107.390139&z=16&output=embed"
      },
      "music": {
        "src": "audio/groom.mp3"
      },
      "images": {
        "hero": "images/optimized/assets/hero_groom.webp",
        "ending": "images/optimized/assets/ending_groom.webp",
        "favicon": "favicon-groom.svg",
        "portraitMain": "images/optimized/assets/son-2.webp",
        "portraitSecondary": "images/optimized/assets/son-1.webp"
      },
      "gift": {
        "bank": "TPBank",
        "accountHolder": "{{couple.groom.fullUpper}}",
        "accountNumber": "0266 8421 401",
        "qrImage": "images/optimized/assets/gift-qr-groom.png",
        "qrAlt": {
          "vi": "Mã QR {{parties.groom.gift.bank}} mừng cưới {{couple.groom.short}}",
          "en": "{{parties.groom.gift.bank}} wedding gift QR for {{couple.groom.short}}"
        }
      },
      "region": {
        "vi": "Đồng Nai",
        "en": "Đồng Nai"
      }
    },
    "single": {
      "date": "2026-11-14",
      "receptionTime": "11:00",
      "receptionEnd": "13:00",
      "city": {
        "vi": "Krông Ana, Đắk Lắk",
        "en": "Krông Ana, Đắk Lắk"
      },
      "lunar": {
        "vi": "Nhằm ngày 06 tháng 10 năm Bính Ngọ",
        "en": "6th day of the 10th lunar month, Year of the Fire Horse"
      },
      "venue": {
        "name": {
          "vi": "Nhà Hàng Hương Lan",
          "en": "Hương Lan Restaurant"
        },
        "address": {
          "vi": "24 Hùng Vương, Krông Ana, Đắk Lắk",
          "en": "24 Hùng Vương Street, Krông Ana, Đắk Lắk"
        },
        "calendarAddress": {
          "vi": "{{parties.single.venue.name}}, {{parties.single.venue.address}}",
          "en": "{{parties.single.venue.name}}, {{parties.single.venue.address}}"
        },
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Nhà+Hàng+Hương+Lan+24+Hùng+Vương+Krông+Ana+Đắk+Lắk",
        "embedUrl": "https://maps.google.com/maps?q=24%20Hung%20Vuong%20Krong%20Ana%20Dak%20Lak&t=&z=15&ie=UTF8&iwloc=&output=embed"
      },
      "music": {
        "src": "audio/bride.mp3"
      },
      "images": {
        "hero": "images/optimized/assets/hero_bride.webp",
        "ending": "images/optimized/assets/ending_bride.webp",
        "favicon": "favicon-groom.svg",
        "portraitMain": "images/optimized/assets/nga-2.webp",
        "portraitSecondary": "images/optimized/assets/nga-1.webp"
      },
      "gift": {
        "bank": "MB",
        "accountHolder": "{{couple.bride.fullUpper}}",
        "accountNumber": "8789 3224 6384 9",
        "qrImage": "images/optimized/assets/gift-qr-bride.svg",
        "qrAlt": {
          "vi": "Mã QR mừng cưới {{couple.groom.short}} & {{couple.bride.short}}",
          "en": "Wedding gift QR for {{couple.groom.short}} & {{couple.bride.short}}"
        }
      },
      "region": {
        "vi": "Đắk Lắk",
        "en": "Đắk Lắk"
      }
    }
  },
  "text": {
    "vi": {
      "page.title": "{{site.titlePrefix}} | {{couple.bride.short}} · {{couple.groom.short}}",
      "page.titleBride": "{{couple.bride.short}} & {{couple.groom.short}} | Lễ Vu Quy",
      "page.titleGroom": "{{couple.groom.short}} & {{couple.bride.short}} | Lễ Tân Hôn",
      "language.label": "Chọn ngôn ngữ",
      "party.eyebrow": "CHỌN TIỆC CƯỚI",
      "party.title": "Bạn tham dự tiệc nào?",
      "party.lead": "Chọn đúng tiệc để xem thời gian và địa điểm dành cho bạn.",
      "party.brideRole": "NHÀ GÁI · LỄ VU QUY",
      "party.brideDate": "{{parties.bride.dateDots}}",
      "party.bridePlace": "{{parties.bride.city}}",
      "party.groomRole": "NHÀ TRAI · LỄ TÂN HÔN",
      "party.groomDate": "{{parties.groom.dateDots}}",
      "party.groomPlace": "{{parties.groom.city}}",
      "party.choose": "XEM THIỆP →",
      "party.adminTool": "✦ TẠO LINK THIỆP CÁ NHÂN HÓA",
      "party.adminToolAria": "Mở công cụ tạo link thiệp cá nhân hóa",
      "hero.topLink": "THÔNG TIN LỄ CƯỚI ↗",
      "hero.overline": "— LỄ THÀNH HÔN —",
      "hero.brideOverline": "— LỄ VU QUY —",
      "hero.groomOverline": "— LỄ TÂN HÔN —",
      "hero.greeting": "Trân trọng kính mời",
      "hero.handwriting": "Cùng nhau viết tiếp những ngày hạnh phúc...",
      "hero.scroll": "CUỘN ĐỂ KHÁM PHÁ ↓",
      "couple.eyebrow": "HAI TRÁI TIM · MỘT HÀNH TRÌNH",
      "couple.heading": "Cô dâu <em>&amp;</em> Chú rể",
      "couple.headingBrideFirst": "Cô dâu <em>&amp;</em> Chú rể",
      "couple.headingGroomFirst": "Chú rể <em>&amp;</em> Cô dâu",
      "couple.lead": "Hai con người, một hành trình, một lời hẹn ước.",
      "couple.groomRole": "Chú rể",
      "couple.groomQuote": "Cảm ơn em đã xuất hiện, để những ngày bình thường cũng trở nên đặc biệt.",
      "couple.brideRole": "Cô dâu",
      "couple.brideQuote": "Cảm ơn anh đã luôn ở đây, cùng em đi qua những khoảnh khắc đẹp nhất của cuộc đời.",
      "couple.son1Alt": "Chân dung chú rể {{couple.groom.short}}",
      "couple.son2Alt": "Ảnh chú rể {{couple.groom.short}} thứ hai",
      "couple.nga1Alt": "Chân dung cô dâu {{couple.bride.short}}",
      "couple.nga2Alt": "Ảnh cô dâu {{couple.bride.short}} thứ hai",
      "family.eyebrow": "CÙNG HAI GIA ĐÌNH",
      "family.title": "Trân trọng báo tin vui",
      "family.lead": "Sự hiện diện của bạn là niềm hạnh phúc của hai gia đình",
      "family.groomSide": "NHÀ TRAI",
      "family.groomTitle": "Gia đình chú rể",
      "family.groomFather": "Ông <strong>{{families.groom.father}}</strong>",
      "family.groomMother": "Bà <strong>{{families.groom.mother}}</strong>",
      "family.groomAddress": "{{families.groom.address}}",
      "family.groomRole": "TRƯỞNG NAM",
      "family.brideSide": "NHÀ GÁI",
      "family.brideTitle": "Gia đình cô dâu",
      "family.brideFather": "Ông <strong>{{families.bride.father}}</strong>",
      "family.brideMother": "Bà <strong>{{families.bride.mother}}</strong>",
      "family.brideAddress": "{{families.bride.address}}",
      "family.brideRole": "ÚT NỮ",
      "album.sectionAria": "Bộ ảnh cưới 3D",
      "album.eyebrow": "BỘ ẢNH CƯỚI",
      "album.heading": "Khoảnh khắc <em>yêu thương</em>",
      "album.lead": "Những thước phim đẹp nhất của chúng mình",
      "album.viewportAria": "Không gian ảnh cưới 3D: kéo, vuốt hoặc lăn chuột để chuyển ảnh; nhấp ảnh để xem toàn màn hình",
      "album.lazy": "Cuộn đến bộ ảnh để xem những khoảnh khắc của chúng mình…",
      "album.hint": "← KÉO / VUỐT / LĂN CHUỘT ĐỂ KHÁM PHÁ KHÔNG GIAN ẢNH →",
      "album.loading": "Đang tải bộ ảnh cưới…",
      "album.empty": "Bộ ảnh cưới đang được chuẩn bị.",
      "album.error": "Chưa tải được bộ ảnh. Bạn kiểm tra kết nối rồi thử lại nhé.",
      "album.retry": "Thử tải lại ảnh",
      "album.fullscreenAria": "Xem ảnh cưới toàn màn hình",
      "album.closeAria": "Đóng ảnh toàn màn hình",
      "album.prevAria": "Ảnh trước",
      "album.nextAria": "Ảnh tiếp theo",
      "album.fullscreenPhotoAlt": "Ảnh cưới {current} trên {total}",
      "events.eyebrow": "LƯU NGÀY HẠNH PHÚC",
      "events.title": "Thông tin lễ cưới",
      "events.lead": "Hân hạnh đón tiếp bạn trong ngày vui trọng đại",
      "events.brideLabel": "LỄ VU QUY · NHÀ GÁI",
      "events.saturday": "THỨ BẢY",
      "events.brideCeremony": "<span>{{parties.bride.ceremonyTime}}</span> Hôn lễ tại tư gia",
      "events.brideReception": "<span>{{parties.bride.receptionTime}}</span> Tiệc mừng tại {{parties.bride.venue.name}}",
      "events.brideAddress": "Địa điểm tiệc: {{parties.bride.venue.address}}",
      "events.brideLunar": "{{parties.bride.lunar}}",
      "events.groomLabel": "LỄ TÂN HÔN · NHÀ TRAI",
      "events.sunday": "CHỦ NHẬT",
      "events.groomCeremony": "<span>{{parties.groom.ceremonyTime}}</span> Hôn lễ tại tư gia",
      "events.groomReception": "<span>{{parties.groom.receptionTime}}</span> Tiệc mừng tại {{parties.groom.venue.name}}",
      "events.groomAddress": "{{parties.groom.venue.address}}",
      "events.groomLunar": "{{parties.groom.lunar}}",
      "events.map": "XEM ĐỊA ĐIỂM",
      "events.calendar": "LƯU VÀO LỊCH",
      "events.brideCalendarAria": "Lưu lễ Vu Quy vào lịch",
      "events.groomCalendarAria": "Lưu lễ Tân Hôn vào lịch",
      "closing.eyebrow": "CẢM ƠN BẠN ĐÃ ĐẾN",
      "closing.title": "Hẹn gặp bạn<br>trong ngày hạnh phúc",
      "footer.love": "GỬI TRỌN YÊU THƯƠNG ♡",
      "map.eyebrow": "CHỈ ĐƯỜNG",
      "map.title": "Hẹn gặp bạn tại đây",
      "map.closeAria": "Đóng bản đồ",
      "map.brideLabel": "NHÀ GÁI · {{parties.bride.dateSlashes}}",
      "map.brideTitle": "{{parties.bride.venue.name}}",
      "map.brideAddress": "{{parties.bride.venue.address}}",
      "map.groomLabel": "NHÀ TRAI · {{parties.groom.dateSlashes}}",
      "map.groomTitle": "{{parties.groom.venue.name}}",
      "map.groomAddress": "{{parties.groom.venue.address}}",
      "map.openMap": "MỞ BẢN ĐỒ ↗",
      "map.brideFrameTitle": "Bản đồ nhà gái",
      "map.groomFrameTitle": "Bản đồ nhà trai",
      "menu.navAria": "Mục lục thiệp cưới",
      "menu.kicker": "THIỆP MỜI LỄ THÀNH HÔN",
      "menu.closeAria": "Đóng mục lục",
      "menu.openAria": "Mở mục lục thiệp cưới",
      "menu.heading": "Khám phá <em>thiệp cưới</em>",
      "menu.description": "Chọn phần bạn muốn xem",
      "menu.home": "Trang đầu thiệp",
      "menu.couple": "Cô dâu & chú rể",
      "menu.coupleBrideFirst": "Cô dâu & chú rể",
      "menu.coupleGroomFirst": "Chú rể & cô dâu",
      "menu.family": "Thông tin hai gia đình",
      "menu.album": "Ảnh cưới",
      "menu.events": "Lịch lễ & tiệc cưới",
      "menu.map": "Bản đồ chỉ đường",
      "menu.gift": "Mừng cưới",
      "menu.groupInvitation": "THIỆP",
      "menu.groupPopup": "POPUP",
      "menu.toggle": "MỤC LỤC",
      "gift.eyebrow": "MỪNG CƯỚI",
      "gift.title": "Gửi lời chúc đến chúng mình",
      "gift.lead": "Cảm ơn tình cảm của bạn dành cho chúng mình ♡",
      "gift.closeAria": "Đóng mừng cưới",
      "gift.qrAria": "Mở mã QR mừng cưới",
      "gift.hint": "Quét mã bằng ứng dụng ngân hàng",
      "music.off": "NHẠC: TẮT",
      "music.on": "NHẠC: BẬT",
      "music.enableAria": "Bật nhạc nền dịu nhẹ",
      "music.disableAria": "Tắt nhạc nền",
      "music.title": "Bật/tắt nhạc nền",
      "countdown.brideTitle": "ĐẾM NGƯỢC ĐẾN LỄ VU QUY",
      "countdown.groomTitle": "ĐẾM NGƯỢC ĐẾN LỄ TÂN HÔN",
      "countdown.brideAria": "Đếm ngược đến lễ Vu Quy nhà gái",
      "countdown.groomAria": "Đếm ngược đến lễ Tân Hôn nhà trai",
      "countdown.days": "NGÀY",
      "countdown.hours": "GIỜ",
      "countdown.minutes": "PHÚT",
      "countdown.seconds": "GIÂY",
      "countdown.finished": "Ngày vui đã đến ♡",
      "guest.default": "bạn",
      "guest.heroBride": "Trân trọng kính mời {guest} tham dự Lễ Vu Quy",
      "guest.heroGroom": "Trân trọng kính mời {guest} tham dự Lễ Tân Hôn",
      "guest.prefix": "Trân trọng kính mời ",
      "calendar.title": "Thêm vào lịch",
      "calendar.close": "Đóng chọn ứng dụng lịch",
      "calendar.description": "Chọn sự kiện và ứng dụng lịch.",
      "calendar.event": "Sự kiện muốn lưu",
      "calendar.ceremony": "Lễ cưới",
      "calendar.reception": "Tiệc mừng",
      "calendar.google": "Google Calendar",
      "calendar.googleHint": "Mở trang tạo sự kiện Google",
      "calendar.outlook": "Outlook.com",
      "calendar.outlookHint": "Mở lịch Microsoft cá nhân trên web",
      "calendar.apple": "Apple Calendar",
      "calendar.device": "Ứng dụng lịch trên máy",
      "calendar.nativeHint": "Tải tệp lịch để mở bằng ứng dụng của bạn",
      "calendar.suggested": "Phù hợp với thiết bị",
      "calendar.other": "Ứng dụng khác",
      "calendar.share": "Chọn ứng dụng trên thiết bị",
      "calendar.all": "Tải cả lễ và tiệc (.ics)",
      "calendar.hint": "Xem lại thông tin rồi xác nhận lưu trong ứng dụng lịch.",
      "calendar.fileHint": "Đã tạo tệp lịch. Mở tệp bằng ứng dụng lịch để xem và lưu.",
      "calendar.shareFail": "Không mở được bảng chọn ứng dụng. Bạn có thể tải tệp lịch ở trên.",
      "calendar.timezone": "Giờ địa phương GMT{{site.timezone}}",
      "calendar.brideFile": "le-vu-quy-{{couple.bride.slug}}-{{couple.groom.slug}}.ics",
      "calendar.groomFile": "le-tan-hon-{{couple.groom.slug}}-{{couple.bride.slug}}.ics",
      "calendar.brideCeremonyTitle": "Lễ Vu Quy · {{couple.bride.short}} & {{couple.groom.short}}",
      "calendar.brideReceptionTitle": "Tiệc Vu Quy · {{couple.bride.short}} & {{couple.groom.short}}",
      "calendar.groomCeremonyTitle": "Lễ Tân Hôn · {{couple.groom.short}} & {{couple.bride.short}}",
      "calendar.groomReceptionTitle": "Tiệc Tân Hôn · {{couple.groom.short}} & {{couple.bride.short}}",
      "calendar.brideCeremonyPlace": "{{parties.bride.home.address}}",
      "calendar.brideReceptionPlace": "{{parties.bride.venue.calendarAddress}}",
      "calendar.groomPlace": "{{parties.groom.venue.calendarAddress}}",
      "calendar.brideCeremonyNote": "{{parties.bride.ceremonyTime}} · Hôn lễ tại tư gia nhà gái",
      "calendar.brideReceptionNote": "{{parties.bride.receptionTime}} · Tiệc mừng",
      "calendar.groomCeremonyNote": "{{parties.groom.ceremonyTime}} · Hôn lễ tại tư gia nhà trai",
      "calendar.groomReceptionNote": "{{parties.groom.receptionTime}} · Tiệc mừng tại tư gia",
      "link.back": "← Quay lại chọn tiệc",
      "link.backAria": "Quay lại màn hình chọn Nhà trai hoặc Nhà gái",
      "link.title": "Tạo thiệp mời riêng",
      "link.brand": "{{couple.bride.short}} & {{couple.groom.short}} · WEDDING {{parties.bride.dateYear}}",
      "link.description": "Nhập tên khách và chọn đúng tiệc. Link tạo ra sẽ mở thiệp với lời chào dành riêng cho người nhận.",
      "link.guest": "Tên khách mời",
      "link.placeholder": "Ví dụ: Anh Minh và chị Lan",
      "link.party": "Khách tham dự",
      "link.bride": "Nhà gái · Lễ Vu Quy · {{parties.bride.dateSlashes}} · {{parties.bride.region}}",
      "link.groom": "Nhà trai · Lễ Tân Hôn · {{parties.groom.dateSlashes}} · {{parties.groom.region}}",
      "link.create": "Tạo link thiệp",
      "link.result": "Link dành cho khách",
      "link.copy": "Sao chép link",
      "link.share": "Chia sẻ",
      "link.preview": "Xem thử thiệp",
      "link.note": "Công cụ này tạo link ngay trên thiết bị; không lưu danh sách khách. Link có tên khách trong URL, nên chỉ chia sẻ với đúng người nhận.",
      "link.invalid": "Vui lòng nhập tên khách và chọn tiệc.",
      "link.copied": "Đã sao chép link!",
      "link.copyFail": "Không thể sao chép tự động. Hãy chọn và sao chép link phía trên.",
      "link.shareFail": "Không thể chia sẻ. Hãy dùng nút Sao chép link.",
      "gate.label": "Cổng mở thiệp cưới",
      "gate.openAria": "Chạm ổ khóa để mở cổng",
      "gate.overline": "NGÀY CHUNG ĐÔI",
      "gate.subtitle": "CHUNG ĐÔI · TRỌN ĐỜI",
      "gate.sun": "MẶT TRỜI",
      "gate.moon": "MẶT TRĂNG",
      "gate.topCaption": "DUYÊN LÀNH TRỜI ĐỊNH",
      "gate.bottomCaption": "✧ TRỌN ĐỜI TỪ ĐÂY ✧",
      "guest.recipientLabel": "Trân trọng kính mời",
      "settings.title": "TÙY CHỈNH THIỆP",
      "settings.open": "Mở tùy chỉnh ngôn ngữ và nhạc",
      "settings.close": "Đóng tùy chỉnh",
      "settings.short": "TÙY CHỈNH",
      "settings.language": "Ngôn ngữ",
      "settings.music": "Âm nhạc",
      "music.paused": "NHẠC: TẠM DỪNG",
      "music.loading": "NHẠC: ĐANG TẢI",
      "music.controlsAria": "Điều khiển nhạc nền",
      "music.bubbleTitle": "Điều khiển nhạc",
      "music.bubblePlayingAria": "Nhạc đang phát, mở các nút điều khiển",
      "music.bubblePausedAria": "Nhạc đã tạm dừng, mở các nút điều khiển",
      "music.pauseAria": "Tạm dừng nhạc",
      "music.resumeAria": "Phát nhạc tiếp",
      "music.stopAria": "Dừng hẳn và ẩn nút nhạc",
      "music.retry": "NHẠC: CHƯA PHÁT · THỬ LẠI",
      "music.cancelAria": "Hủy tải và tạm dừng nhạc",
      "page.titleSingle": "{{couple.groom.short}} & {{couple.bride.short}} | Tiệc cưới",
      "hero.singleOverline": "— TIỆC CƯỚI —",
      "guest.heroSingle": "Trân trọng kính mời {guest} tham dự tiệc cưới",
      "couple.headingSingle": "Chuyện tình của chúng mình",
      "events.singleLabel": "TIỆC CƯỚI · CHUNG VUI CÙNG HAI GIA ĐÌNH",
      "events.singleReception": "<span>{{parties.single.receptionTime}}</span> Đón khách và khai tiệc tại {{parties.single.venue.name}}",
      "events.singleAddress": "{{parties.single.venue.address}}",
      "events.singleLunar": "{{parties.single.lunar}}",
      "events.singleCalendarAria": "Lưu tiệc cưới vào lịch",
      "map.singleLabel": "ĐỊA ĐIỂM TIỆC CƯỚI · {{parties.single.dateSlashes}}",
      "map.singleTitle": "{{parties.single.venue.name}}",
      "map.singleAddress": "{{parties.single.venue.address}}",
      "map.singleFrameTitle": "Bản đồ địa điểm tiệc cưới",
      "countdown.singleTitle": "ĐẾM NGƯỢC ĐẾN TIỆC CƯỚI",
      "countdown.singleAria": "Đếm ngược đến ngày tổ chức tiệc cưới",
      "calendar.singleFile": "tiec-cuoi-{{couple.groom.slug}}-{{couple.bride.slug}}.ics",
      "calendar.singleReceptionTitle": "Tiệc cưới · {{couple.groom.short}} & {{couple.bride.short}}",
      "calendar.singleReceptionPlace": "{{parties.single.venue.calendarAddress}}",
      "calendar.singleReceptionNote": "{{parties.single.receptionTime}} · Tiệc cưới tại {{parties.single.venue.name}}",
      "link.single": "Một tiệc cưới · {{parties.single.dateSlashes}} · {{parties.single.city}}",
      "link.singleDescription": "Nhập tên khách để tạo thiệp cho một tiệc cưới chung. Không cần chọn nhà gái hoặc nhà trai.",
      "link.singleBack": "← Quay lại thiệp cưới",
      "link.singleBackAria": "Trở về thiệp cưới",
      "menu.singleCouple": "Cô dâu & chú rể",
      "link.brandSingle": "{{couple.groom.short}} & {{couple.bride.short}} · WEDDING {{parties.single.dateYear}}",
      "story.eyebrow": "NHỮNG LỜI HẸN CỦA CHÚNG MÌNH",
      "story.title": "Một lời hẹn, <em>một đời thương</em>",
      "story.1.title": "Chọn bên nhau",
      "story.1.text": "Giữa bao điều rộng lớn, chúng mình chọn một người để cùng chia sẻ những ngày bình thường.",
      "story.2.title": "Chọn yêu thương",
      "story.2.text": "Mong những năm tháng phía trước, mỗi lần nhìn lại, vẫn thấy người mình thương ở bên.",
      "story.3.title": "Chọn chung một nhà",
      "story.3.text": "Từ hôm nay, những ước mơ có thêm một người cùng vun đắp. Hành trình mới của chúng mình bắt đầu.",
      "invitation.details": "Thời gian & địa điểm",
      "invitation.directions": "Chỉ đường",
      "invitation.promiseBride": "Từ mái nhà em, mình cùng viết tiếp câu chuyện.",
      "invitation.promiseGroom": "Về chung một nhà, thương nhau một đời.",
      "invitation.promiseSingle": "Hai lời hẹn, một ngày chung đôi.",
      "closing.note": "Cảm ơn bạn đã dành một chỗ cho chúng mình trong những yêu thương của bạn. Hẹn cùng nhau lưu lại một ngày thật đẹp.",
      "album.captionLabel": "Lời tựa của bức ảnh",
      "album.photoRetry": "Ảnh tiếp theo chưa tải được. Bạn thử chuyển ảnh lại nhé."
    },
    "en": {
      "page.title": "{{site.titlePrefix}} | {{couple.bride.short}} · {{couple.groom.short}}",
      "page.titleBride": "{{couple.bride.short}} & {{couple.groom.short}} | Bride's Ceremony",
      "page.titleGroom": "{{couple.groom.short}} & {{couple.bride.short}} | Groom's Ceremony",
      "language.label": "Choose language",
      "party.eyebrow": "CHOOSE YOUR CELEBRATION",
      "party.title": "Which celebration are you attending?",
      "party.lead": "Choose your invitation to see the correct date and location.",
      "party.brideRole": "BRIDE'S FAMILY · VU QUY",
      "party.brideDate": "{{parties.bride.dateDots}}",
      "party.bridePlace": "{{parties.bride.city}}",
      "party.groomRole": "GROOM'S FAMILY · TÂN HÔN",
      "party.groomDate": "{{parties.groom.dateDots}}",
      "party.groomPlace": "{{parties.groom.city}}",
      "party.choose": "VIEW INVITATION →",
      "party.adminTool": "✦ CREATE PERSONALIZED INVITATION LINK",
      "party.adminToolAria": "Open personalized invitation link generator",
      "hero.topLink": "WEDDING DETAILS ↗",
      "hero.overline": "— WEDDING CEREMONY —",
      "hero.brideOverline": "— BRIDE'S CEREMONY —",
      "hero.groomOverline": "— GROOM'S CEREMONY —",
      "hero.greeting": "Cordially invited",
      "hero.handwriting": "Together, we write the next chapter of happiness...",
      "hero.scroll": "SCROLL TO EXPLORE ↓",
      "couple.eyebrow": "TWO SOULS · ONE STORY",
      "couple.heading": "The Bride <em>&amp;</em> Groom",
      "couple.headingBrideFirst": "The Bride <em>&amp;</em> Groom",
      "couple.headingGroomFirst": "The Groom <em>&amp;</em> Bride",
      "couple.lead": "Two people, one journey, one promise for a lifetime.",
      "couple.groomRole": "Groom",
      "couple.groomQuote": "Thank you for coming into my life and making ordinary days feel extraordinary.",
      "couple.brideRole": "Bride",
      "couple.brideQuote": "Thank you for always being here and walking with me through life's most beautiful moments.",
      "couple.son1Alt": "Portrait of groom {{couple.groom.short}}",
      "couple.son2Alt": "Second portrait of groom {{couple.groom.short}}",
      "couple.nga1Alt": "Portrait of bride {{couple.bride.short}}",
      "couple.nga2Alt": "Second portrait of bride {{couple.bride.short}}",
      "family.eyebrow": "WITH OUR FAMILIES",
      "family.title": "With joy, our families announce",
      "family.lead": "Your presence will make this celebration even more meaningful to both families",
      "family.groomSide": "GROOM'S FAMILY",
      "family.groomTitle": "Groom's Family",
      "family.groomFather": "Mr. <strong>{{families.groom.father}}</strong>",
      "family.groomMother": "Mrs. <strong>{{families.groom.mother}}</strong>",
      "family.groomAddress": "{{families.groom.address}}",
      "family.groomRole": "ELDEST SON",
      "family.brideSide": "BRIDE'S FAMILY",
      "family.brideTitle": "Bride's Family",
      "family.brideFather": "Mr. <strong>{{families.bride.father}}</strong>",
      "family.brideMother": "Mrs. <strong>{{families.bride.mother}}</strong>",
      "family.brideAddress": "{{families.bride.address}}",
      "family.brideRole": "YOUNGEST DAUGHTER",
      "album.sectionAria": "3D wedding photo gallery",
      "album.eyebrow": "OUR WEDDING GALLERY",
      "album.heading": "Moments of <em>love</em>",
      "album.lead": "A collection of our most beautiful memories",
      "album.viewportAria": "3D wedding photo space: drag, swipe, or use the mouse wheel to browse; click a photo for fullscreen",
      "album.lazy": "Scroll closer to discover our wedding gallery…",
      "album.hint": "← DRAG / SWIPE / WHEEL TO EXPLORE THE PHOTO SPACE →",
      "album.loading": "Loading our wedding gallery…",
      "album.empty": "Our wedding photo album is being prepared.",
      "album.error": "The photo album could not load. Please check your connection and try again.",
      "album.retry": "Try loading photos again",
      "album.fullscreenAria": "Fullscreen wedding photo viewer",
      "album.closeAria": "Close fullscreen photo",
      "album.prevAria": "Previous photo",
      "album.nextAria": "Next photo",
      "album.fullscreenPhotoAlt": "Wedding photo {current} of {total}",
      "events.eyebrow": "SAVE OUR DATES",
      "events.title": "Wedding details",
      "events.lead": "We would be honored to celebrate this special day with you",
      "events.brideLabel": "BRIDE'S CEREMONY · BRIDE'S FAMILY",
      "events.saturday": "SATURDAY",
      "events.brideCeremony": "<span>{{parties.bride.ceremonyTime}}</span> Wedding ceremony at the family home",
      "events.brideReception": "<span>{{parties.bride.receptionTime}}</span> Reception at {{parties.bride.venue.name}}",
      "events.brideAddress": "Reception venue: {{parties.bride.venue.address}}",
      "events.brideLunar": "{{parties.bride.lunar}}",
      "events.groomLabel": "GROOM'S CEREMONY · GROOM'S FAMILY",
      "events.sunday": "SUNDAY",
      "events.groomCeremony": "<span>{{parties.groom.ceremonyTime}}</span> Wedding ceremony at the family home",
      "events.groomReception": "<span>{{parties.groom.receptionTime}}</span> Reception at the {{parties.groom.venue.name}}",
      "events.groomAddress": "{{parties.groom.venue.address}}",
      "events.groomLunar": "{{parties.groom.lunar}}",
      "events.map": "VIEW LOCATION",
      "events.calendar": "SAVE TO CALENDAR",
      "events.brideCalendarAria": "Save the bride's ceremony to your calendar",
      "events.groomCalendarAria": "Save the groom's ceremony to your calendar",
      "closing.eyebrow": "THANK YOU FOR BEING HERE",
      "closing.title": "See you<br>on our happiest day",
      "footer.love": "MADE WITH LOVE ♡",
      "map.eyebrow": "DIRECTIONS",
      "map.title": "We look forward to seeing you here",
      "map.closeAria": "Close map",
      "map.brideLabel": "BRIDE'S FAMILY · {{parties.bride.dateSlashes}}",
      "map.brideTitle": "{{parties.bride.venue.name}}",
      "map.brideAddress": "{{parties.bride.venue.address}}",
      "map.groomLabel": "GROOM'S FAMILY · {{parties.groom.dateSlashes}}",
      "map.groomTitle": "{{parties.groom.venue.name}}",
      "map.groomAddress": "{{parties.groom.venue.address}}",
      "map.openMap": "OPEN MAP ↗",
      "map.brideFrameTitle": "Bride's family map",
      "map.groomFrameTitle": "Groom's family map",
      "menu.navAria": "Wedding invitation menu",
      "menu.kicker": "WEDDING INVITATION",
      "menu.closeAria": "Close wedding menu",
      "menu.openAria": "Open wedding menu",
      "menu.heading": "Explore the <em>invitation</em>",
      "menu.description": "Choose the section you would like to view",
      "menu.home": "Invitation cover",
      "menu.couple": "Bride & groom",
      "menu.coupleBrideFirst": "Bride & groom",
      "menu.coupleGroomFirst": "Groom & bride",
      "menu.family": "Our families",
      "menu.album": "Wedding photos",
      "menu.events": "Ceremony & reception",
      "menu.map": "Directions",
      "menu.gift": "Wedding gift",
      "menu.groupInvitation": "INVITATION",
      "menu.groupPopup": "POPUPS",
      "menu.toggle": "MENU",
      "gift.eyebrow": "WEDDING GIFT",
      "gift.title": "Send us your warm wishes",
      "gift.lead": "Thank you for celebrating our happiness with us ♡",
      "gift.closeAria": "Close wedding gift",
      "gift.qrAria": "Open wedding gift QR code",
      "gift.hint": "Scan the QR code with your banking app",
      "music.off": "MUSIC: OFF",
      "music.on": "MUSIC: ON",
      "music.enableAria": "Turn on gentle background music",
      "music.disableAria": "Turn off background music",
      "music.title": "Toggle background music",
      "countdown.brideTitle": "COUNTDOWN TO THE BRIDE'S CEREMONY",
      "countdown.groomTitle": "COUNTDOWN TO THE GROOM'S CEREMONY",
      "countdown.brideAria": "Countdown to the bride's family ceremony",
      "countdown.groomAria": "Countdown to the groom's family ceremony",
      "countdown.days": "DAYS",
      "countdown.hours": "HOURS",
      "countdown.minutes": "MINUTES",
      "countdown.seconds": "SECONDS",
      "countdown.finished": "Our wedding day is here ♡",
      "guest.default": "you",
      "guest.heroBride": "We cordially invite {guest} to attend the Bride's Ceremony",
      "guest.heroGroom": "We cordially invite {guest} to attend the Groom's Ceremony",
      "guest.prefix": "Cordially invited: ",
      "calendar.title": "Add to calendar",
      "calendar.close": "Close calendar app chooser",
      "calendar.description": "Choose an event and calendar app.",
      "calendar.event": "Event to save",
      "calendar.ceremony": "Ceremony",
      "calendar.reception": "Reception",
      "calendar.google": "Google Calendar",
      "calendar.googleHint": "Open the Google event editor",
      "calendar.outlook": "Outlook.com",
      "calendar.outlookHint": "Open your personal Microsoft calendar on the web",
      "calendar.apple": "Apple Calendar",
      "calendar.device": "Calendar app on this device",
      "calendar.nativeHint": "Download a calendar file to open in your app",
      "calendar.suggested": "Recommended for your device",
      "calendar.other": "Other apps",
      "calendar.share": "Choose an app on this device",
      "calendar.all": "Download ceremony & reception (.ics)",
      "calendar.hint": "Review and confirm in your calendar app.",
      "calendar.fileHint": "Calendar file created. Open it in your calendar app to review and save.",
      "calendar.shareFail": "The app chooser could not open. You can download the calendar file above.",
      "calendar.timezone": "Local time GMT{{site.timezone}}",
      "calendar.brideFile": "brides-wedding-{{couple.bride.slug}}-{{couple.groom.slug}}.ics",
      "calendar.groomFile": "grooms-wedding-{{couple.groom.slug}}-{{couple.bride.slug}}.ics",
      "calendar.brideCeremonyTitle": "Bride's Wedding Ceremony · {{couple.bride.short}} & {{couple.groom.short}}",
      "calendar.brideReceptionTitle": "Bride's Wedding Reception · {{couple.bride.short}} & {{couple.groom.short}}",
      "calendar.groomCeremonyTitle": "Groom's Wedding Ceremony · {{couple.groom.short}} & {{couple.bride.short}}",
      "calendar.groomReceptionTitle": "Groom's Wedding Reception · {{couple.groom.short}} & {{couple.bride.short}}",
      "calendar.brideCeremonyPlace": "{{parties.bride.home.address}}",
      "calendar.brideReceptionPlace": "{{parties.bride.venue.calendarAddress}}",
      "calendar.groomPlace": "{{parties.groom.venue.calendarAddress}}",
      "calendar.brideCeremonyNote": "{{parties.bride.ceremonyTime}} · Wedding ceremony at the bride's family home",
      "calendar.brideReceptionNote": "{{parties.bride.receptionTime}} · Wedding reception",
      "calendar.groomCeremonyNote": "{{parties.groom.ceremonyTime}} · Wedding ceremony at the groom's family home",
      "calendar.groomReceptionNote": "{{parties.groom.receptionTime}} · Wedding reception at the family home",
      "link.back": "← Back to celebrations",
      "link.backAria": "Return to bride or groom celebration selection",
      "link.title": "Create a personalized invitation",
      "link.brand": "{{couple.bride.short}} & {{couple.groom.short}} · WEDDING {{parties.bride.dateYear}}",
      "link.description": "Enter your guest's name and select the celebration. Their invitation link will display a personal greeting.",
      "link.guest": "Guest name",
      "link.placeholder": "e.g. Minh and Lan",
      "link.party": "Celebration",
      "link.bride": "Bride's family · {{parties.bride.dateEnglish}} · {{parties.bride.region}}",
      "link.groom": "Groom's family · {{parties.groom.dateEnglish}} · {{parties.groom.region}}",
      "link.create": "Create invitation link",
      "link.result": "Guest invitation link",
      "link.copy": "Copy link",
      "link.share": "Share",
      "link.preview": "Preview invitation",
      "link.note": "This tool generates links on your device without storing a guest list. Guest names appear in the URL, so share links only with their intended recipients.",
      "link.invalid": "Please enter a guest name and select a celebration.",
      "link.copied": "Link copied!",
      "link.copyFail": "Automatic copying failed. Please select and copy the link above.",
      "link.shareFail": "Sharing failed. Please use Copy link.",
      "gate.label": "Wedding invitation gate",
      "gate.openAria": "Tap the lock to open the invitation",
      "gate.overline": "OUR WEDDING DAY",
      "gate.subtitle": "TOGETHER · FOREVER",
      "gate.sun": "SUN",
      "gate.moon": "MOON",
      "gate.topCaption": "A CELESTIAL UNION",
      "gate.bottomCaption": "✧ FOREVER BEGINS HERE ✧",
      "guest.recipientLabel": "Cordially inviting",
      "settings.title": "INVITATION SETTINGS",
      "settings.open": "Open language and music settings",
      "settings.close": "Close settings",
      "settings.short": "SETTINGS",
      "settings.language": "Language",
      "settings.music": "Music",
      "music.paused": "MUSIC: PAUSED",
      "music.loading": "MUSIC: LOADING",
      "music.controlsAria": "Background music controls",
      "music.bubbleTitle": "Music controls",
      "music.bubblePlayingAria": "Music playing, open playback controls",
      "music.bubblePausedAria": "Music paused, open playback controls",
      "music.pauseAria": "Pause music",
      "music.resumeAria": "Resume music",
      "music.stopAria": "Stop music and hide the floating button",
      "music.retry": "MUSIC: RETRY PLAYBACK",
      "music.cancelAria": "Cancel loading and pause music",
      "page.titleSingle": "{{couple.groom.short}} & {{couple.bride.short}} | Wedding Reception",
      "hero.singleOverline": "— WEDDING RECEPTION —",
      "guest.heroSingle": "You are cordially invited to our wedding reception, {guest}",
      "couple.headingSingle": "Our love story",
      "events.singleLabel": "WEDDING RECEPTION · BOTH FAMILIES",
      "events.singleReception": "<span>{{parties.single.receptionTime}}</span> Reception at {{parties.single.venue.name}}",
      "events.singleAddress": "{{parties.single.venue.address}}",
      "events.singleLunar": "{{parties.single.lunar}}",
      "events.singleCalendarAria": "Save our wedding reception to your calendar",
      "map.singleLabel": "WEDDING RECEPTION · {{parties.single.dateSlashes}}",
      "map.singleTitle": "{{parties.single.venue.name}}",
      "map.singleAddress": "{{parties.single.venue.address}}",
      "map.singleFrameTitle": "Wedding reception location",
      "countdown.singleTitle": "COUNTDOWN TO OUR WEDDING",
      "countdown.singleAria": "Countdown to our wedding reception",
      "calendar.singleFile": "wedding-{{couple.groom.slug}}-{{couple.bride.slug}}.ics",
      "calendar.singleReceptionTitle": "Wedding Reception · {{couple.groom.short}} & {{couple.bride.short}}",
      "calendar.singleReceptionPlace": "{{parties.single.venue.calendarAddress}}",
      "calendar.singleReceptionNote": "{{parties.single.receptionTime}} · Wedding reception at {{parties.single.venue.name}}",
      "link.single": "Wedding reception · {{parties.single.dateEnglish}} · {{parties.single.city}}",
      "link.singleDescription": "Enter your guest's name to create an invitation for one shared wedding reception.",
      "link.singleBack": "← Back to the wedding invitation",
      "link.singleBackAria": "Return to the wedding invitation",
      "menu.singleCouple": "Bride & groom",
      "link.brandSingle": "{{couple.groom.short}} & {{couple.bride.short}} · WEDDING {{parties.single.dateYear}}",
      "story.eyebrow": "THE PROMISES WE SHARE",
      "story.title": "One promise, <em>a lifetime of love</em>",
      "story.1.title": "Choosing each other",
      "story.1.text": "In a world full of possibilities, we choose one person to share the beauty of ordinary days.",
      "story.2.title": "Choosing love",
      "story.2.text": "May the years ahead always find us looking back with the person we love beside us.",
      "story.3.title": "Choosing a home together",
      "story.3.text": "From this day on, every dream has someone to help it grow. Our next chapter begins.",
      "invitation.details": "Time & venue",
      "invitation.directions": "Directions",
      "invitation.promiseBride": "From her family home, our next chapter begins.",
      "invitation.promiseGroom": "One home, a lifetime of love.",
      "invitation.promiseSingle": "Two promises, one celebration.",
      "closing.note": "Thank you for keeping a place for us in your heart. We look forward to sharing a beautiful day with you.",
      "album.captionLabel": "Photo caption",
      "album.photoRetry": "The next photo could not load. Please try switching photos again."
    }
  },
  "wedding": {
    "mode": "double"
  },
  "story": {
    "images": {
      "together": {
        "src": "images/optimized/assets/promise-5982.webp",
        "sourceName": "NAK_5982.JPG",
        "alt": {
          "vi": "Sơn và Nga đứng bên nhau trên cầu trước cung điện",
          "en": "Sơn and Nga together on the bridge in front of the palace"
        },
        "width": 2000,
        "height": 1333,
        "variants": [
          {
            "src": "images/optimized/assets/promise-5982-1200.webp",
            "width": 1200
          },
          {
            "src": "images/optimized/assets/promise-5982-1600.webp",
            "width": 1600
          },
          {
            "src": "images/optimized/assets/promise-5982.webp",
            "width": 2000
          }
        ],
        "sizes": "(max-width: 414px) calc(180vw - 62px), (max-width: 650px) 684px, (max-width: 1000px) 60vw, 690px"
      },
      "love": {
        "src": "images/optimized/assets/promise-6143.webp",
        "sourceName": "NAK_6143.JPG",
        "alt": {
          "vi": "Sơn và Nga bên hàng cột đỏ trong cung điện",
          "en": "Sơn and Nga beside the red palace columns"
        },
        "width": 1333,
        "height": 2000,
        "variants": [
          {
            "src": "images/optimized/assets/promise-6143-640.webp",
            "width": 640
          },
          {
            "src": "images/optimized/assets/promise-6143-1000.webp",
            "width": 1000
          },
          {
            "src": "images/optimized/assets/promise-6143.webp",
            "width": 1333
          }
        ],
        "sizes": "(max-width: 414px) calc(100vw - 34px), (max-width: 650px) 380px, (max-width: 1000px) 31vw, 365px"
      },
      "home": {
        "src": "images/optimized/assets/promise-6511.webp",
        "sourceName": "NAK_6511.JPG",
        "alt": {
          "vi": "Sơn và Nga ngồi bên nhau trên bậc thềm cung điện",
          "en": "Sơn and Nga sitting together on the palace steps"
        },
        "width": 1333,
        "height": 2000,
        "variants": [
          {
            "src": "images/optimized/assets/promise-6511-640.webp",
            "width": 640
          },
          {
            "src": "images/optimized/assets/promise-6511-1000.webp",
            "width": 1000
          },
          {
            "src": "images/optimized/assets/promise-6511.webp",
            "width": 1333
          }
        ],
        "sizes": "(max-width: 414px) calc(100vw - 34px), (max-width: 650px) 380px, (max-width: 1000px) 31vw, 365px"
      }
    }
  }
};
