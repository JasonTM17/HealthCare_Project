/**
 * Stable presentation boundaries for the native public-page editor. Catalogue
 * facts have a separate editing authority; no field is inferred from the DOM.
 */
export type CmsPageFieldKind = "text" | "rich" | "image";
export interface CmsPageField {
  id: string;
  label: string;
  kind: CmsPageFieldKind;
}
export interface CmsPageSection {
  id: string;
  label: string;
  reorderable: boolean;
  fields: readonly CmsPageField[];
}
export interface CmsPageManifest {
  family: string;
  path: string;
  label: string;
  authorityHref?: string;
  supportsDetail: boolean;
  sections: readonly CmsPageSection[];
  detailSections: readonly CmsPageSection[];
}

export const CMS_PAGE_MANIFESTS: readonly CmsPageManifest[] = [
  {
    "family": "homepage",
    "path": "/",
    "label": "Trang chủ",
    "supportsDetail": false,
    "detailSections": [],
    "sections": [
      {
        "id": "hero",
        "label": "Giới thiệu đầu trang",
        "reorderable": false,
        "fields": [
          {
            "id": "hero.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "hero.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "hero.body",
            "label": "Nội dung",
            "kind": "rich"
          },
          {
            "id": "hero.image",
            "label": "Ảnh minh họa",
            "kind": "image"
          }
        ]
      },
      {
        "id": "assurance",
        "label": "Lựa chọn chăm sóc",
        "reorderable": true,
        "fields": [
          {
            "id": "assurance.doctorTitle",
            "label": "Tiêu đề tìm bác sĩ",
            "kind": "text"
          },
          {
            "id": "assurance.doctorBody",
            "label": "Mô tả tìm bác sĩ",
            "kind": "text"
          },
          {
            "id": "assurance.packageTitle",
            "label": "Tiêu đề gói khám",
            "kind": "text"
          },
          {
            "id": "assurance.packageBody",
            "label": "Mô tả gói khám",
            "kind": "text"
          }
        ]
      },
      {
        "id": "daily-tip",
        "label": "Mẹo sức khỏe",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "notices",
        "label": "Thông báo đã xuất bản",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "care",
        "label": "Lối tắt chăm sóc",
        "reorderable": true,
        "fields": [
          {
            "id": "care.title",
            "label": "Tiêu đề vùng",
            "kind": "text"
          },
          {
            "id": "care.bookingTitle",
            "label": "Tiêu đề đặt lịch",
            "kind": "text"
          },
          {
            "id": "care.bookingBody",
            "label": "Mô tả đặt lịch",
            "kind": "text"
          },
          {
            "id": "care.packageTitle",
            "label": "Tiêu đề gói khám",
            "kind": "text"
          },
          {
            "id": "care.packageBody",
            "label": "Mô tả gói khám",
            "kind": "text"
          },
          {
            "id": "care.specialtyTitle",
            "label": "Tiêu đề chuyên khoa",
            "kind": "text"
          },
          {
            "id": "care.specialtyBody",
            "label": "Mô tả chuyên khoa",
            "kind": "text"
          }
        ]
      },
      {
        "id": "packages",
        "label": "Gói khám",
        "reorderable": true,
        "fields": [
          {
            "id": "packages.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "packages.body",
            "label": "Nội dung",
            "kind": "rich"
          }
        ]
      },
      {
        "id": "specialties",
        "label": "Chuyên khoa",
        "reorderable": true,
        "fields": [
          {
            "id": "specialties.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "specialties.body",
            "label": "Nội dung",
            "kind": "rich"
          }
        ]
      },
      {
        "id": "doctors",
        "label": "Đội ngũ bác sĩ",
        "reorderable": true,
        "fields": [
          {
            "id": "doctors.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "doctors.body",
            "label": "Nội dung",
            "kind": "rich"
          }
        ]
      },
      {
        "id": "experience",
        "label": "Trải nghiệm chăm sóc",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "journey",
        "label": "Hành trình thăm khám",
        "reorderable": true,
        "fields": [
          {
            "id": "journey.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "journey.body",
            "label": "Nội dung",
            "kind": "rich"
          }
        ]
      },
      {
        "id": "branches",
        "label": "Mạng lưới cơ sở",
        "reorderable": true,
        "fields": [
          {
            "id": "branches.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "branches.body",
            "label": "Nội dung",
            "kind": "rich"
          }
        ]
      },
      {
        "id": "articles",
        "label": "Cẩm nang sức khỏe",
        "reorderable": true,
        "fields": [
          {
            "id": "articles.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "articles.body",
            "label": "Nội dung",
            "kind": "rich"
          }
        ]
      },
      {
        "id": "closing",
        "label": "Kết nối chăm sóc",
        "reorderable": true,
        "fields": [
          {
            "id": "closing.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "closing.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "closing.body",
            "label": "Nội dung",
            "kind": "rich"
          }
        ]
      }
    ]
  },
  {
    "family": "about",
    "path": "/about",
    "label": "Về HealthCare",
    "supportsDetail": false,
    "detailSections": [],
    "sections": [
      {
        "id": "hero",
        "label": "Giới thiệu đầu trang",
        "reorderable": false,
        "fields": [
          {
            "id": "hero.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "hero.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "hero.body",
            "label": "Nội dung",
            "kind": "text"
          },
          {
            "id": "hero.image",
            "label": "Ảnh minh họa",
            "kind": "image"
          },
          {
            "id": "hero.caption",
            "label": "Chú thích ảnh",
            "kind": "text"
          }
        ]
      },
      {
        "id": "story",
        "label": "Câu chuyện HealthCare",
        "reorderable": false,
        "fields": [
          {
            "id": "story.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "story.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "story.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "values",
        "label": "Giá trị chăm sóc",
        "reorderable": true,
        "fields": [
          {
            "id": "values.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "values.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "values.body",
            "label": "Nội dung",
            "kind": "text"
          },
          {
            "id": "values.item1.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "values.item2.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "values.item3.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "values.item4.title",
            "label": "Tiêu đề 4",
            "kind": "text"
          },
          {
            "id": "values.item1.body",
            "label": "Nội dung 1",
            "kind": "text"
          },
          {
            "id": "values.item2.body",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "values.item3.body",
            "label": "Nội dung 3",
            "kind": "text"
          },
          {
            "id": "values.item4.body",
            "label": "Nội dung 4",
            "kind": "text"
          }
        ]
      },
      {
        "id": "network",
        "label": "Mạng lưới cơ sở",
        "reorderable": true,
        "fields": [
          {
            "id": "network.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "network.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "network.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "closing",
        "label": "Kết nối",
        "reorderable": true,
        "fields": [
          {
            "id": "closing.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "closing.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "closing.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      }
    ]
  },
  {
    "family": "branches",
    "path": "/branches",
    "label": "Cơ sở",
    "authorityHref": "/admin/branches",
    "supportsDetail": true,
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu trang",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "overview",
        "label": "Giới thiệu mạng lưới",
        "reorderable": false,
        "fields": [
          {
            "id": "overview.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "overview.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "states",
        "label": "Trạng thái danh mục",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "featured",
        "label": "Cơ sở nổi bật",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "directory",
        "label": "Danh sách cơ sở",
        "reorderable": false,
        "fields": []
      }
    ],
    "detailSections": [
      {
        "id": "intro",
        "label": "Giới thiệu cơ sở",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "states",
        "label": "Trạng thái cơ sở",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "profile",
        "label": "Thông tin trong danh mục",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "map",
        "label": "Bản đồ cơ sở",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "followup",
        "label": "Tiện ích và bác sĩ tại cơ sở",
        "reorderable": false,
        "fields": [
          {
            "id": "followup.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "followup.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "followup.eyebrow2",
            "label": "Dòng giới thiệu 2",
            "kind": "text"
          },
          {
            "id": "followup.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          }
        ]
      }
    ]
  },
  {
    "family": "specialties",
    "path": "/specialties",
    "label": "Chuyên khoa",
    "authorityHref": "/admin/specialties",
    "supportsDetail": true,
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu trang",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "overview",
        "label": "Định hướng chuyên khoa",
        "reorderable": true,
        "fields": [
          {
            "id": "overview.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "overview.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "overview.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "guide",
        "label": "Cách đọc danh mục",
        "reorderable": true,
        "fields": [
          {
            "id": "guide.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guide.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "guide.eyebrow2",
            "label": "Dòng giới thiệu 2",
            "kind": "text"
          },
          {
            "id": "guide.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "guide.step01.body",
            "label": "Nội dung 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.body",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.body",
            "label": "Nội dung 3",
            "kind": "text"
          }
        ]
      },
      {
        "id": "directory",
        "label": "Danh sách chuyên khoa",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "closing",
        "label": "Hỗ trợ chọn chuyên khoa",
        "reorderable": false,
        "fields": [
          {
            "id": "closing.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "closing.title",
            "label": "Tiêu đề",
            "kind": "text"
          }
        ]
      }
    ],
    "detailSections": [
      {
        "id": "intro",
        "label": "Giới thiệu chuyên khoa",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "states",
        "label": "Trạng thái chuyên khoa",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "profile",
        "label": "Thông tin trong danh mục",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "guide",
        "label": "Hành trình chăm sóc",
        "reorderable": false,
        "fields": [
          {
            "id": "guide.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guide.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "guide.eyebrow2",
            "label": "Dòng giới thiệu 2",
            "kind": "text"
          },
          {
            "id": "guide.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.body",
            "label": "Nội dung",
            "kind": "text"
          },
          {
            "id": "guide.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "guide.step01.body",
            "label": "Nội dung 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.body",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.body",
            "label": "Nội dung 3",
            "kind": "text"
          }
        ]
      },
      {
        "id": "preparation",
        "label": "Triệu chứng và lộ trình y khoa",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "doctors",
        "label": "Bác sĩ chuyên khoa",
        "reorderable": false,
        "fields": [
          {
            "id": "doctors.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "doctors.title",
            "label": "Tiêu đề",
            "kind": "text"
          }
        ]
      }
    ]
  },
  {
    "family": "doctors",
    "path": "/doctors",
    "label": "Bác sĩ",
    "authorityHref": "/admin/doctors",
    "supportsDetail": true,
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu trang",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "overview",
        "label": "Tìm bác sĩ",
        "reorderable": true,
        "fields": [
          {
            "id": "overview.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "overview.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "overview.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "guide",
        "label": "Cách chọn bác sĩ",
        "reorderable": true,
        "fields": [
          {
            "id": "guide.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guide.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "guide.eyebrow2",
            "label": "Dòng giới thiệu 2",
            "kind": "text"
          },
          {
            "id": "guide.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "guide.step01.body",
            "label": "Nội dung 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.body",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.body",
            "label": "Nội dung 3",
            "kind": "text"
          }
        ]
      },
      {
        "id": "directory",
        "label": "Danh sách và bộ lọc bác sĩ",
        "reorderable": false,
        "fields": []
      }
    ],
    "detailSections": [
      {
        "id": "intro",
        "label": "Giới thiệu hồ sơ",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          }
        ]
      },
      {
        "id": "states",
        "label": "Trạng thái bác sĩ",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "profile",
        "label": "Hồ sơ chuyên môn",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "achievements",
        "label": "Thành tựu chuyên môn",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "guide",
        "label": "Cách chọn bác sĩ",
        "reorderable": false,
        "fields": [
          {
            "id": "guide.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guide.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "guide.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "guide.step01.body",
            "label": "Nội dung 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.body",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.body",
            "label": "Nội dung 3",
            "kind": "text"
          }
        ]
      },
      {
        "id": "support",
        "label": "Chuẩn bị và hỗ trợ",
        "reorderable": false,
        "fields": [
          {
            "id": "support.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "support.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "support.eyebrow2",
            "label": "Dòng giới thiệu 2",
            "kind": "text"
          },
          {
            "id": "support.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          }
        ]
      }
    ]
  },
  {
    "family": "services",
    "path": "/services",
    "label": "Dịch vụ",
    "authorityHref": "/admin/services",
    "supportsDetail": true,
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu trang",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "overview",
        "label": "Giới thiệu dịch vụ",
        "reorderable": true,
        "fields": [
          {
            "id": "overview.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "overview.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "overview.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "guide",
        "label": "Cách đọc danh mục",
        "reorderable": true,
        "fields": [
          {
            "id": "guide.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guide.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "guide.eyebrow2",
            "label": "Dòng giới thiệu 2",
            "kind": "text"
          },
          {
            "id": "guide.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "guide.step01.body",
            "label": "Nội dung 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.body",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.body",
            "label": "Nội dung 3",
            "kind": "text"
          }
        ]
      },
      {
        "id": "directory",
        "label": "Danh sách dịch vụ",
        "reorderable": false,
        "fields": []
      }
    ],
    "detailSections": [
      {
        "id": "intro",
        "label": "Giới thiệu dịch vụ",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "states",
        "label": "Trạng thái dịch vụ",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "profile",
        "label": "Thông tin dịch vụ",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "guide",
        "label": "Cách dùng dịch vụ",
        "reorderable": true,
        "fields": [
          {
            "id": "guide.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guide.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "guide.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "guide.step01.body",
            "label": "Nội dung 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.body",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.body",
            "label": "Nội dung 3",
            "kind": "text"
          }
        ]
      },
      {
        "id": "support",
        "label": "Lựa chọn và bước tiếp theo",
        "reorderable": true,
        "fields": [
          {
            "id": "support.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "support.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "support.body",
            "label": "Nội dung",
            "kind": "text"
          },
          {
            "id": "support.eyebrow2",
            "label": "Dòng giới thiệu 2",
            "kind": "text"
          },
          {
            "id": "support.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "support.body2",
            "label": "Nội dung 2",
            "kind": "text"
          }
        ]
      }
    ]
  },
  {
    "family": "packages",
    "path": "/packages",
    "label": "Gói khám",
    "authorityHref": "/admin/catalog",
    "supportsDetail": true,
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu trang",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          },
          {
            "id": "intro.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "intro.body2",
            "label": "Nội dung 2",
            "kind": "text"
          }
        ]
      },
      {
        "id": "overview",
        "label": "Giới thiệu gói khám",
        "reorderable": true,
        "fields": [
          {
            "id": "overview.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "overview.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "overview.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "guide",
        "label": "Cách chọn gói khám",
        "reorderable": true,
        "fields": [
          {
            "id": "guide.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guide.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "guide.eyebrow2",
            "label": "Dòng giới thiệu 2",
            "kind": "text"
          },
          {
            "id": "guide.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.title3",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "guide.label",
            "label": "Nhãn",
            "kind": "text"
          },
          {
            "id": "guide.title4",
            "label": "Tiêu đề 4",
            "kind": "text"
          },
          {
            "id": "guide.title5",
            "label": "Tiêu đề 5",
            "kind": "text"
          },
          {
            "id": "guide.label2",
            "label": "Nhãn 2",
            "kind": "text"
          },
          {
            "id": "guide.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "guide.step01.body",
            "label": "Nội dung 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.body",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.body",
            "label": "Nội dung 3",
            "kind": "text"
          }
        ]
      },
      {
        "id": "directory",
        "label": "Danh sách gói khám",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "booking",
        "label": "Đặt lịch theo gói",
        "reorderable": false,
        "fields": []
      }
    ],
    "detailSections": [
      {
        "id": "states",
        "label": "Điều hướng và trạng thái gói khám",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "profile",
        "label": "Thông tin gói khám",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "guide",
        "label": "Cách chọn gói khám",
        "reorderable": false,
        "fields": [
          {
            "id": "guide.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guide.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "guide.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "guide.step01.body",
            "label": "Nội dung 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.body",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.body",
            "label": "Nội dung 3",
            "kind": "text"
          }
        ]
      },
      {
        "id": "preparation",
        "label": "Nội dung và chuẩn bị y khoa",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "support",
        "label": "Đăng ký khám",
        "reorderable": false,
        "fields": [
          {
            "id": "support.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "support.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "support.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "booking",
        "label": "Đặt lịch theo gói",
        "reorderable": false,
        "fields": []
      }
    ]
  },
  {
    "family": "articles",
    "path": "/articles",
    "label": "Cẩm nang",
    "authorityHref": "/admin/catalog",
    "supportsDetail": true,
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu trang",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "overview",
        "label": "Giới thiệu cẩm nang",
        "reorderable": true,
        "fields": [
          {
            "id": "overview.label",
            "label": "Nhãn",
            "kind": "text"
          },
          {
            "id": "overview.label2",
            "label": "Nhãn 2",
            "kind": "text"
          },
          {
            "id": "overview.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "overview.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "guidance",
        "label": "Hướng dẫn và bài viết nổi bật",
        "reorderable": true,
        "fields": [
          {
            "id": "guidance.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guidance.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "guidance.eyebrow2",
            "label": "Dòng giới thiệu 2",
            "kind": "text"
          },
          {
            "id": "guidance.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          }
        ]
      },
      {
        "id": "directory",
        "label": "Bộ lọc và bài viết công khai",
        "reorderable": false,
        "fields": []
      }
    ],
    "detailSections": [
      {
        "id": "states",
        "label": "Điều hướng và trạng thái bài viết",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "editorial",
        "label": "Bài viết đã được duyệt",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "support",
        "label": "Thông tin hỗ trợ",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "related",
        "label": "Chuyên khoa liên quan",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "takeaways",
        "label": "Thông điệp y khoa",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "warning",
        "label": "Cảnh báo y tế",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "reading",
        "label": "Hướng dẫn đọc",
        "reorderable": false,
        "fields": [
          {
            "id": "reading.label",
            "label": "Nhãn",
            "kind": "text"
          },
          {
            "id": "reading.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "reading.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "reading.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "reading.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "reading.step01.body",
            "label": "Nội dung 1",
            "kind": "text"
          },
          {
            "id": "reading.step02.body",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "reading.step03.body",
            "label": "Nội dung 3",
            "kind": "text"
          }
        ]
      }
    ]
  },
  {
    "family": "careers",
    "path": "/careers",
    "label": "Tuyển dụng",
    "authorityHref": "/admin/careers",
    "supportsDetail": false,
    "detailSections": [],
    "sections": [
      {
        "id": "hero",
        "label": "Giới thiệu tuyển dụng",
        "reorderable": false,
        "fields": [
          {
            "id": "hero.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "hero.title",
            "label": "Tiêu đề tuyển dụng",
            "kind": "text"
          },
          {
            "id": "hero.body",
            "label": "Mô tả tuyển dụng",
            "kind": "text"
          },
          {
            "id": "hero.ctaLabel",
            "label": "Nhãn xem vị trí",
            "kind": "text"
          },
          {
            "id": "hero.step1.title",
            "label": "Tiêu đề bước 1",
            "kind": "text"
          },
          {
            "id": "hero.step1.body",
            "label": "Mô tả bước 1",
            "kind": "text"
          },
          {
            "id": "hero.step2.title",
            "label": "Tiêu đề bước 2",
            "kind": "text"
          },
          {
            "id": "hero.step2.body",
            "label": "Mô tả bước 2",
            "kind": "text"
          },
          {
            "id": "hero.step3.title",
            "label": "Tiêu đề bước 3",
            "kind": "text"
          },
          {
            "id": "hero.step3.body",
            "label": "Mô tả bước 3",
            "kind": "text"
          }
        ]
      },
      {
        "id": "values",
        "label": "Môi trường làm việc",
        "reorderable": false,
        "fields": [
          {
            "id": "values.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "values.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "values.body",
            "label": "Nội dung",
            "kind": "text"
          },
          {
            "id": "values.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "values.body2",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "values.title3",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "values.body3",
            "label": "Nội dung 3",
            "kind": "text"
          },
          {
            "id": "values.title4",
            "label": "Tiêu đề 4",
            "kind": "text"
          },
          {
            "id": "values.body4",
            "label": "Nội dung 4",
            "kind": "text"
          },
          {
            "id": "values.authoredEyebrow",
            "label": "Dòng giới thiệu thông tin ứng viên",
            "kind": "text"
          },
          {
            "id": "values.authoredTitle",
            "label": "Tiêu đề thông tin ứng viên",
            "kind": "text"
          },
          {
            "id": "values.authoredBody",
            "label": "Nội dung thông tin ứng viên",
            "kind": "text"
          }
        ]
      },
      {
        "id": "openings",
        "label": "Vị trí tuyển dụng",
        "reorderable": false,
        "fields": [
          {
            "id": "openings.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "openings.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "openings.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "recruitment",
        "label": "Thông tin ứng tuyển",
        "reorderable": false,
        "fields": [
          {
            "id": "recruitment.title",
            "label": "Tiêu đề",
            "kind": "text"
          }
        ]
      }
    ]
  },
  {
    "family": "search",
    "path": "/search",
    "label": "Tìm kiếm",
    "supportsDetail": false,
    "detailSections": [],
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu trang",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "overview",
        "label": "Giới thiệu tìm kiếm",
        "reorderable": true,
        "fields": [
          {
            "id": "overview.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "overview.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "overview.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "guide",
        "label": "Lộ trình tìm kiếm",
        "reorderable": true,
        "fields": [
          {
            "id": "guide.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guide.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "guide.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          }
        ]
      },
      {
        "id": "results",
        "label": "Form và kết quả tìm kiếm",
        "reorderable": false,
        "fields": []
      }
    ]
  },
  {
    "family": "dat-lich",
    "path": "/dat-lich",
    "label": "Đặt lịch",
    "supportsDetail": false,
    "detailSections": [],
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu đặt lịch",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.label2",
            "label": "Nhãn 2",
            "kind": "text"
          },
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "booking",
        "label": "Form đặt lịch",
        "reorderable": false,
        "fields": [
          {
            "id": "booking.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "booking.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "booking.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "stages",
        "label": "Các bước đặt lịch",
        "reorderable": false,
        "fields": [
          {
            "id": "stages.item1.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "stages.item2.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "stages.item3.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "stages.item4.title",
            "label": "Tiêu đề 4",
            "kind": "text"
          },
          {
            "id": "stages.item1.body",
            "label": "Nội dung 1",
            "kind": "text"
          },
          {
            "id": "stages.item2.body",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "stages.item3.body",
            "label": "Nội dung 3",
            "kind": "text"
          },
          {
            "id": "stages.item4.body",
            "label": "Nội dung 4",
            "kind": "text"
          }
        ]
      },
      {
        "id": "support",
        "label": "Hỗ trợ trước khi đặt lịch",
        "reorderable": false,
        "fields": [
          {
            "id": "support.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "support.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "support.eyebrow2",
            "label": "Dòng giới thiệu 2",
            "kind": "text"
          },
          {
            "id": "support.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          }
        ]
      },
      {
        "id": "branches",
        "label": "Chọn cơ sở",
        "reorderable": false,
        "fields": [
          {
            "id": "branches.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "branches.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "branches.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      }
    ]
  },
  {
    "family": "contact",
    "path": "/contact",
    "label": "Liên hệ",
    "authorityHref": "/admin/branches",
    "supportsDetail": false,
    "detailSections": [],
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu trang",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "states",
        "label": "Trạng thái thông tin liên hệ",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "overview",
        "label": "Giới thiệu liên hệ",
        "reorderable": false,
        "fields": [
          {
            "id": "overview.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "overview.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "overview.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "guide",
        "label": "Liên hệ nhanh và hướng dẫn",
        "reorderable": false,
        "fields": [
          {
            "id": "guide.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guide.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "guide.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.eyebrow2",
            "label": "Dòng giới thiệu 2",
            "kind": "text"
          },
          {
            "id": "guide.title3",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "guide.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          }
        ]
      },
      {
        "id": "branches",
        "label": "Danh sách liên hệ",
        "reorderable": false,
        "fields": []
      }
    ]
  },
  {
    "family": "faq",
    "path": "/faq",
    "label": "Câu hỏi thường gặp",
    "authorityHref": "/admin/catalog",
    "supportsDetail": false,
    "detailSections": [],
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu trang",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "states",
        "label": "Trạng thái câu hỏi",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "overview",
        "label": "Giới thiệu câu hỏi",
        "reorderable": true,
        "fields": [
          {
            "id": "overview.label",
            "label": "Nhãn",
            "kind": "text"
          },
          {
            "id": "overview.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "overview.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "overview.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "guide",
        "label": "Hỗ trợ và cách đọc nhanh",
        "reorderable": true,
        "fields": [
          {
            "id": "guide.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guide.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "guide.body",
            "label": "Nội dung",
            "kind": "text"
          },
          {
            "id": "guide.eyebrow2",
            "label": "Dòng giới thiệu 2",
            "kind": "text"
          },
          {
            "id": "guide.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "guide.step01.body",
            "label": "Nội dung 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.body",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.body",
            "label": "Nội dung 3",
            "kind": "text"
          }
        ]
      },
      {
        "id": "questions",
        "label": "Câu hỏi đã được duyệt",
        "reorderable": false,
        "fields": []
      }
    ]
  },
  {
    "family": "huong-dan",
    "path": "/huong-dan",
    "label": "Hướng dẫn",
    "supportsDetail": false,
    "detailSections": [],
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu hướng dẫn",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.label2",
            "label": "Nhãn 2",
            "kind": "text"
          },
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "states",
        "label": "Trạng thái hướng dẫn",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "journey",
        "label": "Hành trình khám",
        "reorderable": false,
        "fields": [
          {
            "id": "journey.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "journey.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "journey.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "journey.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "journey.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "journey.step04.title",
            "label": "Tiêu đề 4",
            "kind": "text"
          }
        ]
      },
      {
        "id": "preparation",
        "label": "Chuẩn bị trước khi khám",
        "reorderable": false,
        "fields": [
          {
            "id": "preparation.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "preparation.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "preparation.eyebrow2",
            "label": "Dòng giới thiệu 2",
            "kind": "text"
          },
          {
            "id": "preparation.title2",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "preparation.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "questions",
        "label": "Câu hỏi thường gặp",
        "reorderable": false,
        "fields": [
          {
            "id": "questions.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "questions.title",
            "label": "Tiêu đề",
            "kind": "text"
          }
        ]
      }
    ]
  },
  {
    "family": "tra-cuu",
    "path": "/tra-cuu",
    "label": "Tra cứu lịch hẹn",
    "supportsDetail": false,
    "detailSections": [],
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu tra cứu",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.label2",
            "label": "Nhãn 2",
            "kind": "text"
          },
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "overview",
        "label": "Giới thiệu quản lý lịch",
        "reorderable": true,
        "fields": [
          {
            "id": "overview.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "overview.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "overview.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "guide",
        "label": "Cách tra cứu an toàn",
        "reorderable": true,
        "fields": [
          {
            "id": "guide.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guide.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "guide.step01.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "guide.step01.body",
            "label": "Nội dung 1",
            "kind": "text"
          },
          {
            "id": "guide.step02.body",
            "label": "Nội dung 2",
            "kind": "text"
          },
          {
            "id": "guide.step03.body",
            "label": "Nội dung 3",
            "kind": "text"
          }
        ]
      },
      {
        "id": "lookup",
        "label": "Form và kết quả tra cứu",
        "reorderable": false,
        "fields": []
      }
    ]
  },
  {
    "family": "benh-pho-bien",
    "path": "/benh-pho-bien",
    "label": "Bệnh phổ biến",
    "authorityHref": "/admin/catalog",
    "supportsDetail": true,
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu trang",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          }
        ]
      },
      {
        "id": "filters",
        "label": "Bộ lọc bệnh phổ biến",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "guides",
        "label": "Hướng dẫn sức khỏe",
        "reorderable": false,
        "fields": [
          {
            "id": "guides.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guides.title",
            "label": "Tiêu đề",
            "kind": "text"
          }
        ]
      },
      {
        "id": "questions",
        "label": "Hỏi đáp đã duyệt",
        "reorderable": false,
        "fields": [
          {
            "id": "questions.label",
            "label": "Nhãn",
            "kind": "text"
          },
          {
            "id": "questions.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "questions.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      }
    ],
    "detailSections": [
      {
        "id": "states",
        "label": "Điều hướng và trạng thái hướng dẫn",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "profile",
        "label": "Tiêu đề và thông tin y khoa",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "toc",
        "label": "Mục lục y khoa",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "editorial",
        "label": "Nội dung y khoa đã duyệt",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "support",
        "label": "Hỗ trợ thăm khám",
        "reorderable": false,
        "fields": [
          {
            "id": "support.title",
            "label": "Tiêu đề",
            "kind": "text"
          }
        ]
      },
      {
        "id": "disclaimer",
        "label": "Lưu ý y khoa",
        "reorderable": false,
        "fields": []
      }
    ]
  },
  {
    "family": "gop-y",
    "path": "/gop-y",
    "label": "Góp ý",
    "supportsDetail": false,
    "detailSections": [],
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu góp ý",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "feedback",
        "label": "Form và lịch sử góp ý",
        "reorderable": false,
        "fields": []
      },
      {
        "id": "guidance",
        "label": "Quy trình tiếp nhận góp ý",
        "reorderable": false,
        "fields": [
          {
            "id": "guidance.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "guidance.title",
            "label": "Tiêu đề quy trình",
            "kind": "text"
          },
          {
            "id": "guidance.item1.title",
            "label": "Tiêu đề chủ đề 1",
            "kind": "text"
          },
          {
            "id": "guidance.item1.body",
            "label": "Nội dung chủ đề 1",
            "kind": "text"
          },
          {
            "id": "guidance.item2.title",
            "label": "Tiêu đề chủ đề 2",
            "kind": "text"
          },
          {
            "id": "guidance.item2.body",
            "label": "Nội dung chủ đề 2",
            "kind": "text"
          },
          {
            "id": "guidance.item3.title",
            "label": "Tiêu đề chủ đề 3",
            "kind": "text"
          },
          {
            "id": "guidance.item3.body",
            "label": "Nội dung chủ đề 3",
            "kind": "text"
          }
        ]
      }
    ]
  },
  {
    "family": "chinh-sach-bao-mat",
    "path": "/chinh-sach-bao-mat",
    "label": "Chính sách bảo mật",
    "supportsDetail": false,
    "detailSections": [],
    "sections": [
      {
        "id": "intro",
        "label": "Giới thiệu chính sách",
        "reorderable": false,
        "fields": [
          {
            "id": "intro.eyebrow",
            "label": "Dòng giới thiệu",
            "kind": "text"
          },
          {
            "id": "intro.title",
            "label": "Tiêu đề",
            "kind": "text"
          },
          {
            "id": "intro.body",
            "label": "Nội dung",
            "kind": "text"
          }
        ]
      },
      {
        "id": "policies",
        "label": "Nội dung chính sách",
        "reorderable": false,
        "fields": [
          {
            "id": "policies.item1.title",
            "label": "Tiêu đề 1",
            "kind": "text"
          },
          {
            "id": "policies.item2.title",
            "label": "Tiêu đề 2",
            "kind": "text"
          },
          {
            "id": "policies.item3.title",
            "label": "Tiêu đề 3",
            "kind": "text"
          },
          {
            "id": "policies.item4.title",
            "label": "Tiêu đề 4",
            "kind": "text"
          },
          {
            "id": "policies.item1.body",
            "label": "Nội dung chính sách 1",
            "kind": "text"
          },
          {
            "id": "policies.item2.body",
            "label": "Nội dung chính sách 2",
            "kind": "text"
          },
          {
            "id": "policies.item3.body",
            "label": "Nội dung chính sách 3",
            "kind": "text"
          },
          {
            "id": "policies.item4.body",
            "label": "Nội dung chính sách 4",
            "kind": "text"
          }
        ]
      },
      {
        "id": "version",
        "label": "Thông tin phiên bản",
        "reorderable": false,
        "fields": []
      }
    ]
  }
];

const ALIASES: Readonly<Record<string, string>> = {
  "bac-si": "doctors", "chuyen-khoa": "specialties", "goi-kham": "packages",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface CmsPageIdentity {
  manifest: CmsPageManifest;
  slotKey: string;
  canonicalPath: string;
  entityId?: string;
  sections: readonly CmsPageSection[];
}

/** A caller must resolve an actual catalogue UUID before targeting a detail. */
export function resolveCmsPageIdentity(pathname: string, entityId?: string): CmsPageIdentity | null {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || /[\\?#\u0000-\u001f\u007f]/.test(pathname)) return null;
  let parts: string[];
  try { parts = pathname.replace(/\/$/, "").split("/").slice(1).map(decodeURIComponent); }
  catch { return null; }
  if (parts.some((part) => /[/%\\?#\u0000-\u001f\u007f]/.test(part) || part === "." || part === "..")) return null;
  const route = parts[0] || "homepage";
  if (route === "homepage" && pathname !== "/") return null;
  const family = Object.prototype.hasOwnProperty.call(ALIASES, route) ? ALIASES[route] : route;
  const manifest = CMS_PAGE_MANIFESTS.find((entry) => entry.family === family);
  if (!manifest || parts.length > 2) return null;
  const slug = parts[1];
  if (parts.length === 2 && (!slug || slug.length > 120)) return null;
  if (!slug) {
    if (entityId) return null;
    return { manifest, slotKey: `${family}.layout`, canonicalPath: manifest.path, sections: manifest.sections };
  }
  if (!manifest.supportsDetail || !entityId || !UUID.test(entityId)) return null;
  const normalizedId = entityId.toLowerCase();
  return {
    manifest, entityId: normalizedId,
    slotKey: `${family}.detail-${normalizedId}.layout`,
    canonicalPath: `${manifest.path}/${encodeURIComponent(slug)}`,
    sections: manifest.detailSections,
  };
}
