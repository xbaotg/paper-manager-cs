import { FilePlus2, BarChart3, LayoutGrid } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: FilePlus2,
    title: "Nhập liệu dễ dàng",
    description:
      "Form nhập bài báo trực quan, nhanh chóng. Chỉ cần điền thông tin cơ bản: tên bài báo, năm, hội nghị/tạp chí và tác giả.",
  },
  {
    icon: BarChart3,
    title: "Thống kê & Báo cáo",
    description:
      "Biểu đồ trực quan theo năm, hội nghị. Tự động tổng hợp số liệu để phục vụ báo cáo và đánh giá hoạt động nghiên cứu.",
  },
  {
    icon: LayoutGrid,
    title: "Danh sách công bố",
    description:
      "Bảng danh sách bài báo chuyên nghiệp với tìm kiếm, sắp xếp và phân trang. Sẵn sàng để tích hợp vào website Khoa.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-card">
      <div className="container mx-auto px-6 max-w-5xl text-center">
        <span className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-primary/8 text-xs font-semibold text-primary uppercase tracking-wider">
          Tính năng
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold font-heading mb-4">
          Tại sao chọn Paper Manager?
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-14">
          Giải pháp toàn diện cho việc quản lý và thống kê công bố khoa học của
          Khoa.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <Card
              key={i}
              className="group relative overflow-hidden border-border/50 bg-background/60 backdrop-blur-sm hover:-translate-y-1 hover:shadow-xl hover:border-primary/20 transition-all duration-300 cursor-pointer"
            >
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="pt-8 pb-8 px-6">
                <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary mb-6 mx-auto group-hover:scale-105 transition-transform">
                  <f.icon className="size-7" />
                </div>
                <h3 className="text-lg font-semibold font-heading mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
