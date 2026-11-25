const DB_STORAGE_KEY = 'anie_cms_emog_db_v4_no_id';
const SCHEMA_STORAGE_KEY = 'anie_cms_emog_schema_v4_no_id';
const API_BASE = window.location.origin;

// ── Member authentication (server-side; the token is issued by /api/auth/login) ──
const AUTH_TOKEN_KEY = 'anie_cms_token';
function getAuthToken() { try { return localStorage.getItem(AUTH_TOKEN_KEY); } catch (e) { return null; } }
function setAuthToken(t) { try { t ? localStorage.setItem(AUTH_TOKEN_KEY, t) : localStorage.removeItem(AUTH_TOKEN_KEY); } catch (e) { /* ignore */ } }
// Attach the token to every same-origin /api call; tell the page when the server rejects it.
(function () {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const isApi = url.startsWith(API_BASE + '/api/') || url.startsWith('/api/');
    const token = getAuthToken();
    if (isApi && token && !(init.headers && init.headers.Authorization)) {
      init = { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + token } };
    }
    const res = await nativeFetch(input, init);
    if (isApi && token && res.status === 401 && !url.includes('/api/auth/')) {
      window.dispatchEvent(new CustomEvent('anie-auth-expired'));
    }
    return res;
  };
})();

// 5-Table Schema WITHOUT `id` field (all columns freely editable/deletable)
const DEFAULT_TABLE_SCHEMAS = {
  people: [
    { name: 'avatar_url', label: 'Ảnh đại diện', type: 'image' },
    { name: 'name', label: 'Họ và tên', type: 'text', required: true },
    {
      name: 'role_category', label: 'Phân nhóm (Role Category)', type: 'select', options: [
        'Core Leaders',
        'Core Researchers',
        'Master Students',
        'Undergraduate Students',
        'Alliance Cooperatives'
      ]
    },
    { name: 'title', label: 'Vị trí / Vai trò', type: 'text', required: true },
    { name: 'academic_rank', label: 'Học hàm / Học vị / Khóa', type: 'text' },
    { name: 'research_focus', label: 'Hướng nghiên cứu trọng tâm', type: 'text', required: true },
    { name: 'email', label: 'Email liên hệ', type: 'text' },
    { name: 'bio', label: 'Giới thiệu ngắn', type: 'textarea' }
  ],
  resources: [
    { name: 'item_name', label: 'Tên Bộ dữ liệu / Thiết bị / Pipeline', type: 'text', required: true },
    {
      name: 'resource_type', label: 'Phân loại', type: 'select', options: [
        'Dataset',
        'Hardware Device',
        'Software Pipeline'
      ]
    },
    { name: 'specifications', label: 'Đặc tả kỹ thuật / Kích thích', type: 'text', required: true },
    { name: 'scale_info', label: 'Quy mô / Số lượng mẫu hiện có', type: 'text', required: true },
    { name: 'notes', label: 'Ghi chú khai thác & Annotation', type: 'textarea' }
  ],
  publications: [
    { name: 'title', label: 'Tên Công bố / Nghiên cứu Tổng quan', type: 'text', required: true },
    {
      name: 'pub_type', label: 'Loại hình', type: 'select', options: [
        'Systematic Review',
        'Research Study',
        'Journal Paper',
        'Conference Paper'
      ]
    },
    { name: 'domain', label: 'Lĩnh vực', type: 'text', required: true },
    { name: 'year', label: 'Năm / Trạng thái', type: 'text', required: true },
    { name: 'authors', label: 'Nhóm tác giả thực hiện', type: 'text' },
    { name: 'status', label: 'Tình trạng', type: 'text', required: true }
  ],
  demos_products: [
    { name: 'thumbnail_url', label: 'Ảnh minh họa giao diện (Tùy chọn)', type: 'image' },
    { name: 'video_url', label: 'Video Demo', type: 'video' },
    { name: 'name', label: 'Tên Hệ thống / Nguyên mẫu Demo', type: 'text', required: true },
    { name: 'target_condition', label: 'Đối tượng hỗ trợ', type: 'text', required: true },
    { name: 'phase', label: 'Pha tác động', type: 'select', options: ['Screening', 'Intervention', 'Both'] },
    { name: 'tech_stack', label: 'Công nghệ cốt lõi', type: 'text', required: true },
    { name: 'status', label: 'Mức độ hoàn thiện hiện tại', type: 'text', required: true },
    { name: 'description', label: 'Mô tả chức năng & kết quả', type: 'textarea', required: true }
  ],
  news_collaboration: [
    { name: 'cover_url', label: 'Ảnh minh họa sự kiện (Tùy chọn)', type: 'image' },
    { name: 'title', label: 'Tiêu đề Tin tức / Tên Đơn vị Đối tác', type: 'text', required: true },
    {
      name: 'entry_type', label: 'Phân loại', type: 'select', options: [
        'Experiment Update',
        'Project Milestone',
        'Seminar & Event',
        'Partner Institution'
      ]
    },
    { name: 'date_or_spec', label: 'Thời gian / Phân nhóm đối tác', type: 'text', required: true },
    { name: 'summary', label: 'Tóm tắt / Thông tin liên hệ', type: 'text', required: true },
    { name: 'content', label: 'Nội dung chi tiết', type: 'textarea' }
  ]
};

// 100% Real, Existing Resources & Completed Works (WITHOUT `id` property)
const INITIAL_SEED_DB = {
  people: [
    {
      avatar_url: 'https://placehold.co/240x280/1e3d54/ffffff?text=Core+Leader+01',
      name: 'Thầy/Cô Dẫn dắt Nhóm nghiên cứu 01 (Co-Lead)',
      role_category: 'Core Leaders',
      title: 'Đồng Trưởng nhóm Nghiên cứu ANIE',
      academic_rank: 'PGS.TS. / TS. – Giảng viên cao cấp',
      research_focus: 'AI & Human-Centered Technologies, Visual Attention, Multimodal Behavioral Analysis, Inclusive Education',
      email: 'colead1.anie@university.edu.vn',
      bio: 'Dẫn dắt định hướng nghiên cứu khoa học công nghệ của ANIE Research Group, chủ trì nghiên cứu đa phương thức cho sàng lọc và can thiệp cá nhân hóa.'
    },
    {
      avatar_url: 'https://placehold.co/240x280/1e3d54/ffffff?text=Core+Leader+02',
      name: 'Thầy/Cô Dẫn dắt Nhóm nghiên cứu 02 (Co-Lead)',
      role_category: 'Core Leaders',
      title: 'Đồng Trưởng nhóm Nghiên cứu ANIE',
      academic_rank: 'TS. – Giảng viên chính',
      research_focus: 'Human-Computer Interaction (HCI), Eye-Tracking & Physiological Computing, Adaptive Learning Systems',
      email: 'colead2.anie@university.edu.vn',
      bio: 'Đồng dẫn dắt ANIE Research Group, điều phối thực nghiệm Eye-tracking/EEG/VR và kết nối liên ngành với Giáo dục đặc biệt & Tâm lý học lâm sàng.'
    },
    {
      avatar_url: 'https://placehold.co/240x280/0f766e/ffffff?text=Researcher+01',
      name: 'Nghiên cứu viên Tạo nguồn 01',
      role_category: 'Core Researchers',
      title: 'Core Researcher',
      academic_rank: 'ThS. / NCS',
      research_focus: 'Computer Vision, Scanpath/Gaze Representation, Synthetic Gaze & Data-Efficient Learning',
      email: 'researcher1.anie@university.edu.vn',
      bio: 'Phụ trách nhánh biểu diễn hành vi thị giác và giải quyết bài toán khan hiếm dữ liệu (data scarcity) cho Dyslexia & ASD.'
    },
    {
      avatar_url: 'https://placehold.co/240x280/0f766e/ffffff?text=Researcher+02',
      name: 'Nghiên cứu viên Tạo nguồn 02',
      role_category: 'Core Researchers',
      title: 'Core Researcher',
      academic_rank: 'ThS. / NCS',
      research_focus: 'Dyscalculia, Mathematical Eye-Tracking Stimuli, Personalized Learning & Adaptive Interfaces',
      email: 'researcher2.anie@university.edu.vn',
      bio: 'Phát triển hệ thống thu thập dữ liệu, thiết kế kích thích toán học phục vụ eye-tracking và nghiên cứu can thiệp kỹ năng Toán.'
    },
    {
      avatar_url: 'https://placehold.co/240x280/0f766e/ffffff?text=Researcher+03',
      name: 'Nghiên cứu viên Tạo nguồn 03',
      role_category: 'Core Researchers',
      title: 'Core Researcher',
      academic_rank: 'ThS. / Giảng viên tạo nguồn',
      research_focus: 'EEG + Eye Tracking Multimodal Fusion, Attention Detection & Handwriting Representation',
      email: 'researcher3.anie@university.edu.vn',
      bio: 'Điều phối nghiên cứu phát hiện sự chú ý (ADHD/Attention) và phân tích dữ liệu chữ viết tay học sinh tiểu học (Dysgraphia).'
    },
    {
      avatar_url: 'https://placehold.co/240x280/b45309/ffffff?text=Master+Y2-01',
      name: 'Học viên Cao học Năm 2 (01)',
      role_category: 'Master Students',
      title: 'Master Student',
      academic_rank: 'Cao học Năm 2',
      research_focus: 'Vietnamese Reading Eye-Tracking Pipeline & ReadMe Personalized Reading Support',
      email: 'master_y2_01@university.edu.vn',
      bio: 'Xây dựng pipeline trích xuất fixation/saccade, heatmap/scanpath và phát triển hệ thống ReadMe.'
    },
    {
      avatar_url: 'https://placehold.co/240x280/b45309/ffffff?text=Master+Y2-02',
      name: 'Học viên Cao học Năm 2 (02)',
      role_category: 'Master Students',
      title: 'Master Student',
      academic_rank: 'Cao học Năm 2',
      research_focus: 'ASD Visual Attention Analysis & VR Assistive System',
      email: 'master_y2_02@university.edu.vn',
      bio: 'Phân tích dữ liệu eye-tracking trên 55 trẻ (28 ASD, 27 đối chứng) và hoàn thiện phiên bản cơ bản hệ thống VR.'
    },
    {
      avatar_url: 'https://placehold.co/240x280/d97706/ffffff?text=04+Masters+Y1',
      name: 'Nhóm 04 Học viên Cao học Năm 1',
      role_category: 'Master Students',
      title: 'Master Students (Năm 1)',
      academic_rank: '04 Học viên Cao học',
      research_focus: 'Self-supervised Gaze Learning, Handwriting CV (Lớp 1–5), Multimodal EEG-Gaze & Adaptive HCI',
      email: 'masters_y1@university.edu.vn',
      bio: 'Triển khai các hướng nghiên cứu AI/CV cho hành vi thị giác, khai thác dữ liệu viết tay và bài toán giao thoa Attention.'
    },
    {
      avatar_url: 'https://placehold.co/240x280/047857/ffffff?text=~30+Undergrads',
      name: 'Khối ~30 Sinh viên Nghiên cứu (Năm 2, 3, 4)',
      role_category: 'Undergraduate Students',
      title: 'Undergraduate Research Assistants',
      academic_rank: 'Sinh viên Đại học',
      research_focus: 'Thu thập dữ liệu RAI, Xử lý dữ liệu viết tay, Phát triển ReadMe, CASD, VR & Pipeline AI',
      email: 'undergrad.anie@university.edu.vn',
      bio: 'Tham gia trực tiếp vào các đợt thực nghiệm tại trường tiểu học, phát triển phần mềm và huấn luyện mô hình.'
    },
    {
      avatar_url: 'https://placehold.co/240x280/3730a3/ffffff?text=Alliance+Partners',
      name: 'Chuyên gia Giáo dục Đặc biệt & Tâm lý Lâm sàng',
      role_category: 'Alliance Cooperatives',
      title: 'Đối tác Liên ngành',
      academic_rank: 'Chuyên gia GD Đặc biệt & Tâm lý học Lâm sàng',
      research_focus: 'Chuẩn hóa bài đánh giá, gán nhãn dữ liệu chuyên gia (Annotation) & đồng thiết kế học liệu',
      email: 'alliance.partners@anie.vn',
      bio: 'Phối hợp chặt chẽ cùng ANIE Research Group để đảm bảo tính chuẩn xác lâm sàng và sư phạm trong mọi thực nghiệm.'
    }
  ],
  resources: [
    {
      item_name: 'Vietnamese Reading Eye-Tracking Dataset (Pilot & RAI)',
      resource_type: 'Dataset',
      specifications: 'Kích thích: Pseudoword, Two-syllable word, Paragraph reading tiếng Việt',
      scale_info: '15 học sinh lớp 2 (03 dyslexia, 12 phát triển điển hình) + Đang mở rộng qua RAI',
      notes: 'Trích xuất đầy đủ fixation, saccade, heatmap, scanpath phục vụ phân tích hành vi thị giác và huấn luyện synthetic gaze.'
    },
    {
      item_name: 'Primary School Handwriting Dataset (Grades 1–5)',
      resource_type: 'Dataset',
      specifications: 'Chữ viết tay học sinh từ Lớp 1 đến Lớp 5 (mỗi bản 1–4 dòng)',
      scale_info: '300–400 bản mỗi lớp (~1.500–2.000 mẫu), đã có annotation của chuyên gia',
      notes: 'Phục vụ phát triển bài toán Computer Vision (handwriting representation) và đánh giá writing difficulties.'
    },
    {
      item_name: 'Dyscalculia & Mathematical Learning Gaze Dataset',
      resource_type: 'Dataset',
      specifications: 'Dữ liệu eye-tracking kết hợp kích thích toán học (Math stimuli) & dữ liệu sinh lý học',
      scale_info: 'Dữ liệu nghiên cứu luận án + Dữ liệu mở rộng trong dự án Responsible AI (RAI)',
      notes: 'Thu thập đồng bộ qua hệ thống phần mềm chuyên dụng phục vụ nghiên cứu khó khăn học Toán.'
    },
    {
      item_name: 'ASD Visual Attention Eye-Tracking Dataset',
      resource_type: 'Dataset',
      specifications: 'Dữ liệu chuyển động mắt và hành vi thị giác ở trẻ 3–7 tuổi',
      scale_info: '55 trẻ (28 trẻ ASD; 27 trẻ nhóm đối chứng comparison) + Mở rộng qua RAI',
      notes: 'Kết nối trực tiếp với công cụ đánh giá CASD và môi trường thực tế ảo (VR).'
    },
    {
      item_name: 'Multimodal Lab Hardware (Eye-Tracker + EEG + VR)',
      resource_type: 'Hardware Device',
      specifications: 'Thiết bị Eye-tracker độ chính xác cao, hệ thống đo điện não đồ EEG & kính Thực tế ảo VR',
      scale_info: 'Hạ tầng phòng thí nghiệm ANIE Research Group',
      notes: 'Phục vụ đo đạc đồng thời attention, engagement, distraction, cognitive load và triển khai can thiệp VR.'
    },
    {
      item_name: 'Vietnamese Reading & Gaze Analysis Pipeline',
      resource_type: 'Software Pipeline',
      specifications: 'Stimuli Presentation ➔ Eye-Tracking Capture ➔ Fixation/Saccade ➔ Heatmap/Scanpath',
      scale_info: 'Đang vận hành thực tế trong các đợt thu thập dữ liệu Đọc & Toán',
      notes: 'Hỗ trợ thu thập, tiền xử lý, trực quan hóa và trích xuất đặc trưng chuyển động mắt tự động.'
    }
  ],
  publications: [
    {
      title: 'Systematic Review về các nghiên cứu Eye Tracking liên quan đến chứng khó đọc (Dyslexia)',
      pub_type: 'Systematic Review',
      domain: 'Dyslexia / Reading',
      year: 'Đã hoàn thành',
      authors: 'ANIE Research Group',
      status: 'Đã thực hiện'
    },
    {
      title: 'Nghiên cứu tổng quan 01 & 02 về Dyscalculia (Physiological data, Eye tracking, AI, Technology-assisted intervention, Personalized learning)',
      pub_type: 'Systematic Review',
      domain: 'Dyscalculia / Mathematics',
      year: 'Đã hoàn thành',
      authors: 'ANIE Research Group',
      status: 'Đã thực hiện (02 nghiên cứu tổng quan)'
    },
    {
      title: 'Các nghiên cứu tổng quan về Eye Tracking và ADHD & Thực nghiệm kết hợp EEG + Eye Tracking cho Attention Detection',
      pub_type: 'Systematic Review',
      domain: 'ADHD / Attention',
      year: 'Đã hoàn thành',
      authors: 'ANIE Research Group',
      status: 'Đã thực hiện'
    },
    {
      title: 'Nghiên cứu đặc trưng hành vi thị giác trong quá trình đọc tiếng Việt & Synthetic Gaze cho bài toán Data Scarcity',
      pub_type: 'Research Study',
      domain: 'Dyslexia / AI & CV',
      year: 'Đang triển khai',
      authors: 'ANIE Research Group',
      status: 'Có kết quả thực nghiệm pilot'
    }
  ],
  demos_products: [
    {
      thumbnail_url: 'https://placehold.co/480x270/1e3d54/ffffff?text=ReadMe+System',
      video_url: '',
      name: 'ReadMe – Personalized Reading Support System',
      target_condition: 'Dyslexia / Trẻ gặp khó khăn về Đọc',
      phase: 'Both',
      tech_stack: 'Adaptive UI/HCI, Gaze Analytics Integration, Behavioral Logging',
      status: 'Nguyên mẫu hoạt động & đang thu thập dữ liệu',
      description: 'Hệ thống hỗ trợ đọc cá nhân hóa cho học sinh tiểu học, tích hợp tùy biến trình bày văn bản và ghi nhận hành vi tương tác phục vụ huấn luyện AI.'
    },
    {
      thumbnail_url: 'https://placehold.co/480x270/0f766e/ffffff?text=Eye-Tracking+Suite',
      video_url: '',
      name: 'Vietnamese Eye-Tracking & Scanpath Analysis Suite',
      target_condition: 'Dyslexia, Dyscalculia, ADHD & ASD',
      phase: 'Screening',
      tech_stack: 'Python, Computer Vision, Fixation/Saccade Extractor, Heatmap/Scanpath',
      status: 'Hoàn thiện & đang vận hành thực nghiệm',
      description: 'Hệ thống phần mềm đồng bộ thiết kế kích thích đọc/toán tiếng Việt, thu thập chuyển động mắt, vẽ heatmap và phân tích scanpath.'
    },
    {
      thumbnail_url: 'https://placehold.co/480x270/3730a3/ffffff?text=VR+for+ASD',
      video_url: '',
      name: 'Hệ thống Thực tế ảo (VR) Hỗ trợ Trẻ ASD',
      target_condition: 'Trẻ Rối loạn Phổ Tự kỷ (ASD)',
      phase: 'Intervention',
      tech_stack: 'Virtual Reality (VR), 3D Interactive Scenarios, Behavioral Tracking',
      status: 'Phiên bản cơ bản đã tương đối hoàn chỉnh',
      description: 'Môi trường thực tế ảo kiểm soát mức độ kích thích giác quan giúp trẻ ASD rèn luyện chú ý thị giác và kỹ năng tương tác xã hội.'
    },
    {
      thumbnail_url: 'https://placehold.co/480x270/0e7490/ffffff?text=CASD+Tool',
      video_url: '',
      name: 'Hệ thống CASD',
      target_condition: 'Trẻ Rối loạn Phổ Tự kỷ (ASD)',
      phase: 'Screening',
      tech_stack: 'Clinical Assessment Software, Visual Attention Analytics',
      status: 'Đang vận hành trong nghiên cứu ASD',
      description: 'Công cụ phần mềm đánh giá hành vi thị giác và phối hợp dữ liệu thực nghiệm eye-tracking trên nhóm trẻ từ 3–7 tuổi.'
    },
    {
      thumbnail_url: 'https://placehold.co/480x270/b45309/ffffff?text=Math+Eye-Tracking',
      video_url: '',
      name: 'Math Eye-Tracking & Stimuli Acquisition Platform',
      target_condition: 'Dyscalculia / Khó khăn về Toán',
      phase: 'Screening',
      tech_stack: 'Math Stimuli Engine, Eye-Tracking & Physiological Sync',
      status: 'Đang vận hành thu thập dữ liệu RAI',
      description: 'Hệ thống phần mềm và bộ kích thích toán học chuyên biệt phục vụ thu thập dữ liệu eye-tracking và tín hiệu sinh lý học.'
    }
  ],
  news_collaboration: [
    {
      cover_url: 'https://placehold.co/480x270/1e3d54/ffffff?text=RAI+Data+Collection',
      title: 'Tiếp tục mở rộng thu thập dữ liệu đa miền trong Dự án Responsible AI (RAI)',
      entry_type: 'Experiment Update',
      date_or_spec: 'Đang diễn ra',
      summary: 'Mở rộng tập mẫu thực nghiệm cho Dyslexia (Reading), Dyscalculia (Math) và ASD theo chuẩn đạo đức nghiên cứu.',
      content: 'Nhóm nghiên cứu ANIE phối hợp cùng các chuyên gia và trường tiểu học tiếp tục mở rộng thu thập dữ liệu chuyển động mắt và tương tác học tập cho dự án Responsible AI (RAI).'
    },
    {
      cover_url: 'https://placehold.co/480x270/0f766e/ffffff?text=ASD+55+Children+Study',
      title: 'Hoàn thành thực nghiệm Eye-Tracking trên 55 trẻ (3–7 tuổi) và phiên bản cơ bản hệ thống VR cho ASD',
      entry_type: 'Project Milestone',
      date_or_spec: 'Cột mốc hoàn thành',
      summary: 'Thu thập và phân tích dữ liệu trên 28 trẻ ASD cùng 27 trẻ đối chứng, song song hoàn thiện bản cơ bản hệ thống VR và CASD.',
      content: 'Dữ liệu thực nghiệm trên 55 trẻ độ tuổi 3–7 tạo nền tảng quan trọng cho nghiên cứu biểu diễn ánh nhìn (gaze representation) và đánh giá hiệu quả tương tác trong môi trường VR.'
    },
    {
      cover_url: 'https://placehold.co/480x270/b45309/ffffff?text=Handwriting+Grades+1-5',
      title: 'Hoàn tất gán nhãn chuyên gia cho bộ dữ liệu chữ viết tay học sinh Tiểu học (Lớp 1 – Lớp 5)',
      entry_type: 'Project Milestone',
      date_or_spec: 'Cột mốc dữ liệu',
      summary: 'Hoàn thiện 300–400 mẫu viết tay mỗi khối lớp (~1.500–2.000 bản, 1–4 dòng/bản) có đầy đủ annotation lâm sàng/sư phạm.',
      content: 'Bộ dữ liệu chữ viết tay tiểu học tiếng Việt đã sẵn sàng phục vụ nghiên cứu Computer Vision (handwriting representation) và phát triển công cụ hỗ trợ sàng lọc Dysgraphia.'
    },
    {
      cover_url: '',
      title: 'Mạng lưới Trường Tiểu học & Trung tâm Hỗ trợ Phát triển Giáo dục Hòa nhập',
      entry_type: 'Partner Institution',
      date_or_spec: 'Đơn vị Phối hợp Thực nghiệm',
      summary: 'Phối hợp triển khai thực nghiệm đọc tiếng Việt (pilot lớp 2), viết tay tiểu học (lớp 1–5) và dự án RAI.',
      content: 'Đồng hành cùng ANIE Research Group trong quá trình thiết kế thực nghiệm thân thiện với trẻ em, thu thập dữ liệu chuẩn hóa và đánh giá thử nghiệm nguyên mẫu ReadMe.'
    },
    {
      cover_url: '',
      title: 'Trung tâm Giáo dục Đặc biệt, Chuyên gia Tâm lý Lâm sàng & Mạng lưới Gia đình',
      entry_type: 'Partner Institution',
      date_or_spec: 'Đối tác Chuyên môn & Thử nghiệm',
      summary: 'Cố vấn lâm sàng, gán nhãn chuyên gia (expert annotation) và phối hợp thử nghiệm CASD & hệ thống VR.',
      content: 'Hỗ trợ chuẩn hóa quy trình đánh giá, đảm bảo tính khoa học, an toàn cảm giác cho trẻ ASD/ADHD và tiếp nhận thử nghiệm các công cụ hỗ trợ cá nhân hóa.'
    }
  ]
};

let TABLE_SCHEMAS = {};
let db = {};
let currentCMSTable = 'people';
let currentResourceFilter = 'ALL';
let editingRecordIndex = null;
let editingTable = null;
let editingSchemaColKey = null;
let isMemberAuthenticated = false;
let currentPortalMode = 'public';
let isServerConnected = false;

// ==========================================
// HIGH-CAPACITY INDEXEDDB ENGINE (SOLVES LOCALSTORAGE 5MB QUOTA LIMIT FOR VIDEOS)
// ==========================================
const IDB_NAME = 'anie_portal_high_capacity_db';
const IDB_VERSION = 1;
const IDB_STORE = 'kv_store';
const inMemoryMediaMap = {};

function openAnieIDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (evt) => {
      const idb = evt.target.result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE);
      }
    };
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSetItem(key, val, timeoutMs = 6000) {
  try {
    const idb = await openAnieIDB();
    return await Promise.race([
      new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(val, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error('IndexedDB aborted'));
      }),
      new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs))
    ]);
  } catch (err) {
    return false;
  }
}

async function idbGetItem(key) {
  try {
    const idb = await openAnieIDB();
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return null;
  }
}

// Hydrate any idb://media_... references into fast Blob Object URLs for playback
async function hydrateMediaReferencesInDB() {
  for (const tbl of Object.keys(db)) {
    if (!Array.isArray(db[tbl])) continue;
    for (const row of db[tbl]) {
      if (!row || typeof row !== 'object') continue;
      for (const k of Object.keys(row)) {
        const v = row[k];
        if (typeof v === 'string' && v.startsWith('idb://') && !inMemoryMediaMap[v]) {
          const blobOrData = await idbGetItem(v);
          if (blobOrData instanceof Blob) {
            inMemoryMediaMap[v] = URL.createObjectURL(blobOrData);
          } else if (typeof blobOrData === 'string') {
            inMemoryMediaMap[v] = blobOrData;
          }
        }
      }
      if (Array.isArray(row.extra_videos)) {
        for (const vid of row.extra_videos) {
          if (vid && typeof vid.url === 'string' && vid.url.startsWith('idb://') && !inMemoryMediaMap[vid.url]) {
            const blobOrData = await idbGetItem(vid.url);
            if (blobOrData instanceof Blob) {
              inMemoryMediaMap[vid.url] = URL.createObjectURL(blobOrData);
            } else if (typeof blobOrData === 'string') {
              inMemoryMediaMap[vid.url] = blobOrData;
            }
          }
        }
      }
    }
  }
}

// Safe localStorage setter that never throws QuotaExceededError
function safeLocalStorageSet(key, valueStr) {
  try {
    localStorage.setItem(key, valueStr);
    return true;
  } catch (quotaErr) {
    console.warn(`[INFO] Dữ liệu vượt giới hạn 5MB của localStorage (${key}), hệ thống tự động lưu vào IndexedDB dung lượng cao.`);
    return false;
  }
}

// Sanitize all schemas and records to completely strip any `id` field
function stripIdFromAllTables() {
  Object.keys(TABLE_SCHEMAS).forEach(tbl => {
    if (Array.isArray(TABLE_SCHEMAS[tbl])) {
      TABLE_SCHEMAS[tbl] = TABLE_SCHEMAS[tbl]
        .filter(col => col && col.name && col.name.toLowerCase() !== 'id')
        .map(col => ({ ...col, core: false }));
    }
  });

  Object.keys(db).forEach(tbl => {
    if (Array.isArray(db[tbl])) {
      db[tbl].forEach(row => {
        if (row && typeof row === 'object') {
          delete row.id;
          delete row.ID;
        }
      });
    }
  });
}

// Ensure all 5 required tables & schemas exist (auto-migrates from legacy server tables if present)
function ensureRequiredTablesExist() {
  let migrated = false;

  Object.keys(DEFAULT_TABLE_SCHEMAS).forEach(tbl => {
    if (!Array.isArray(TABLE_SCHEMAS[tbl]) || TABLE_SCHEMAS[tbl].length === 0) {
      TABLE_SCHEMAS[tbl] = JSON.parse(JSON.stringify(DEFAULT_TABLE_SCHEMAS[tbl]));
      migrated = true;
    }
  });

  // Ensure demos_products has clean video_url column
  if (Array.isArray(TABLE_SCHEMAS.demos_products)) {
    const existingVidCol = TABLE_SCHEMAS.demos_products.find(c => c.name === 'video_url');
    if (!existingVidCol) {
      TABLE_SCHEMAS.demos_products.splice(1, 0, {
        name: 'video_url',
        label: 'Video Demo',
        type: 'video',
        core: false
      });
      migrated = true;
    } else if (existingVidCol.label === 'Video Demo (YouTube / MP4 / Tải file - Tùy chọn)') {
      existingVidCol.label = 'Video Demo';
      migrated = true;
    }
  }

  // Migrate or initialize missing data arrays
  if (!Array.isArray(db.resources)) {
    if (Array.isArray(db.resources_networking) && db.resources_networking.length > 0) {
      db.resources = db.resources_networking
        .filter(r => r && r.resource_type !== 'Partner Institution')
        .map(r => ({ ...r }));
    } else {
      db.resources = JSON.parse(JSON.stringify(INITIAL_SEED_DB.resources));
    }
    migrated = true;
  }

  if (!Array.isArray(db.demos_products)) {
    if (Array.isArray(db.products) && db.products.length > 0) {
      db.demos_products = db.products.map(p => ({
        thumbnail_url: p.thumbnail_url || '',
        video_url: p.video_url || '',
        ...p
      }));
    } else {
      db.demos_products = JSON.parse(JSON.stringify(INITIAL_SEED_DB.demos_products));
    }
    migrated = true;
  }

  if (!Array.isArray(db.news_collaboration)) {
    db.news_collaboration = JSON.parse(JSON.stringify(INITIAL_SEED_DB.news_collaboration));
    if (Array.isArray(db.resources_networking)) {
      const legacyPartners = db.resources_networking.filter(r => r && r.resource_type === 'Partner Institution');
      legacyPartners.forEach(lp => {
        const exists = db.news_collaboration.some(n => n.title === lp.item_name);
        if (!exists && lp.item_name) {
          db.news_collaboration.push({
            cover_url: '',
            title: lp.item_name,
            entry_type: 'Partner Institution',
            date_or_spec: lp.specifications || 'Đơn vị Phối hợp',
            summary: lp.scale_info || '',
            content: lp.notes || ''
          });
        }
      });
    }
    migrated = true;
  }

  Object.keys(DEFAULT_TABLE_SCHEMAS).forEach(tbl => {
    if (!Array.isArray(db[tbl])) {
      db[tbl] = JSON.parse(JSON.stringify(INITIAL_SEED_DB[tbl] || []));
      migrated = true;
    }
  });

  return migrated;
}

// ==========================================
// SERVER API SYNC + INDEXEDDB + LOCALSTORAGE FALLBACK
// ==========================================
async function loadFromServer() {
  try {
    const res = await fetch(`${API_BASE}/api/data`);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      throw new Error('Server JSON API not reachable');
    }
    const json = await res.json();
    if (json.success && json.data && json.schemas) {
      db = json.data;
      TABLE_SCHEMAS = json.schemas;
      const migrated = ensureRequiredTablesExist();
      stripIdFromAllTables();
      await hydrateMediaReferencesInDB();
      isServerConnected = true;
      updateServerSyncBadge(true);
      if (migrated) {
        await commitToServer();
      }
      return true;
    }
    throw new Error('Invalid server response');
  } catch (e) {
    isServerConnected = false;
    updateServerSyncBadge(false);
    try {
      const idbDb = await idbGetItem(DB_STORAGE_KEY);
      const idbSchema = await idbGetItem(SCHEMA_STORAGE_KEY);
      const rawDb = localStorage.getItem(DB_STORAGE_KEY);
      const rawSchema = localStorage.getItem(SCHEMA_STORAGE_KEY);

      db = idbDb ? idbDb : (rawDb ? JSON.parse(rawDb) : JSON.parse(JSON.stringify(INITIAL_SEED_DB)));
      TABLE_SCHEMAS = idbSchema ? idbSchema : (rawSchema ? JSON.parse(rawSchema) : JSON.parse(JSON.stringify(DEFAULT_TABLE_SCHEMAS)));
    } catch (err) {
      db = JSON.parse(JSON.stringify(INITIAL_SEED_DB));
      TABLE_SCHEMAS = JSON.parse(JSON.stringify(DEFAULT_TABLE_SCHEMAS));
    }
    ensureRequiredTablesExist();
    stripIdFromAllTables();
    await hydrateMediaReferencesInDB();
    return false;
  }
}

function updateServerSyncBadge(connected) {
  const badge = document.getElementById('serverSyncBadge');
  if (!badge) return;
  if (connected) {
    badge.textContent = 'Server API Connected';
    badge.className = 'px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[10px] font-mono';
  } else {
    badge.textContent = 'IndexedDB High-Capacity Sync';
    badge.className = 'px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono';
  }
}

async function commitToServer() {
  stripIdFromAllTables();
  await hydrateMediaReferencesInDB();

  // Always store in high-capacity IndexedDB (supports large videos & datasets)
  await idbSetItem(DB_STORAGE_KEY, db);
  await idbSetItem(SCHEMA_STORAGE_KEY, TABLE_SCHEMAS);

  // Also attempt localStorage sync safely without throwing QuotaExceededError
  safeLocalStorageSet(DB_STORAGE_KEY, JSON.stringify(db));
  safeLocalStorageSet(SCHEMA_STORAGE_KEY, JSON.stringify(TABLE_SCHEMAS));

  if (isServerConnected && getAuthToken()) {
    try {
      await fetch(`${API_BASE}/api/data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: db })
      });
      await fetch(`${API_BASE}/api/schemas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemas: TABLE_SCHEMAS })
      });
    } catch (e) {
      isServerConnected = false;
      updateServerSyncBadge(false);
    }
  }
  renderAllSections();
  renderCMSTable();
  renderCMSTableCountCards();
}

function commitDatabase() {
  commitToServer();
}

function commitSchemas() {
  commitToServer();
}

// ==========================================
// HELPERS: VIDEO PLAYER (YOUTUBE CLICK-TO-PLAY, VIMEO, DRIVE, IDB, MP4) & CUSTOM FIELDS
// ==========================================
function activateYouTubeIframe(containerEl, videoId) {
  if (!containerEl || !videoId) return;
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const isFileOrNullOrigin =
    window.location.protocol === 'file:' ||
    window.location.origin === 'null' ||
    !window.location.origin ||
    window.location.href.startsWith('about:') ||
    window.location.href.startsWith('blob:');

  if (isFileOrNullOrigin) {
    window.open(watchUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  const embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  containerEl.innerHTML = `
    <iframe
      width="100%"
      height="100%"
      src="${embedSrc}"
      title="YouTube video player"
      frameborder="0"
      referrerpolicy="strict-origin-when-cross-origin"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      class="w-full h-full border-0">
    </iframe>
  `;
}

function renderVideoPlayerHTML(videoUrl, extraClasses = 'w-full aspect-video rounded-xl bg-slate-950 overflow-hidden shadow-sm') {
  if (!videoUrl || typeof videoUrl !== 'string') return '';
  let trimmed = videoUrl.trim();
  if (!trimmed) return '';

  // Resolve idb:// reference to its hydrated Blob URL if stored in IndexedDB
  if (trimmed.startsWith('idb://')) {
    if (inMemoryMediaMap[trimmed]) {
      trimmed = inMemoryMediaMap[trimmed];
    } else {
      idbGetItem(trimmed).then(blob => {
        if (blob instanceof Blob) {
          inMemoryMediaMap[trimmed] = URL.createObjectURL(blob);
          renderAllSections();
        }
      });
      return `<div class="${extraClasses} flex items-center justify-center text-white text-xs">Đang nạp video từ bộ nhớ...</div>`;
    }
  }

  // Detect YouTube URL (watch?v=, youtu.be/, embed/, shorts/, live/)
  const ytMatch = trimmed.match(/(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts|live)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbHq = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return `
      <div class="${extraClasses} relative group select-none" onclick="event.stopPropagation()">
        <div class="w-full h-full relative cursor-pointer" onclick="activateYouTubeIframe(this.parentElement, '${videoId}')">
          <img src="${thumbHq}" alt="YouTube Video Thumbnail" referrerpolicy="no-referrer" class="w-full h-full object-cover opacity-95 group-hover:scale-105 group-hover:opacity-100 transition duration-300" onerror="this.src='https://placehold.co/640x360/0f172a/ffffff?text=YouTube+Video'" />
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/20 to-transparent flex flex-col items-center justify-center p-3">
            <div class="w-16 h-11 rounded-2xl bg-red-600 group-hover:bg-red-500 text-white flex items-center justify-center shadow-xl transition transform group-hover:scale-110">
              <svg class="w-7 h-7 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <span class="mt-2.5 px-3 py-1 rounded-full bg-slate-900/90 text-white text-[11px] font-bold border border-white/20 shadow">
              ▶ Phát Video YouTube
            </span>
          </div>
        </div>
        <div class="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
          <span class="px-2 py-0.5 rounded bg-black/70 text-white/90 text-[10px] font-medium">YouTube</span>
          <a href="${watchUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()"
            class="pointer-events-auto px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold flex items-center gap-1 shadow transition">
            <span>Xem trực tiếp trên YouTube ↗</span>
          </a>
        </div>
      </div>
    `;
  }

  // Detect Vimeo URL
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return `
      <div class="${extraClasses}" onclick="event.stopPropagation()">
        <iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" class="w-full h-full border-0" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
      </div>
    `;
  }

  // Detect Google Drive file preview link
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    // Absolute-fill iframe inside a fixed 16:9 box so Drive's player always fits the card
    const driveId = driveMatch[1];
    return `
      <div class="space-y-1.5 w-full" onclick="event.stopPropagation()">
        <div class="${extraClasses} relative">
          <iframe src="https://drive.google.com/file/d/${driveId}/preview" title="Google Drive video" loading="lazy"
                  class="absolute inset-0 w-full h-full border-0" scrolling="no"
                  allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>
        </div>
        <div class="flex items-center justify-between text-[10px] font-semibold text-slate-500 px-0.5">
          <span>Google Drive</span>
          <a href="https://drive.google.com/file/d/${driveId}/view" target="_blank" rel="noopener noreferrer"
             class="text-[#1e3d54] hover:text-teal-700 hover:underline">Mở trong Drive ↗</a>
        </div>
      </div>
    `;
  }

  // Direct video file (.mp4, .webm, .ogg, .mov, uploaded data:video/..., blob:..., or server /uploads/...)
  const resolvedSrc = (trimmed.startsWith('http') || trimmed.startsWith('data:') || trimmed.startsWith('blob:'))
    ? trimmed
    : `${API_BASE}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;

  // HLS stream (.m3u8) → played through hls.js (native on Safari)
  if (/\.m3u8(\?|#|$)/i.test(resolvedSrc)) {
    return `
      <div class="${extraClasses} flex items-center justify-center" onclick="event.stopPropagation()">
        <video data-hls-src="${resolvedSrc}" controls preload="metadata" playsinline class="w-full h-full object-contain bg-black"></video>
      </div>
    `;
  }

  return `
    <div class="${extraClasses} flex items-center justify-center" onclick="event.stopPropagation()">
      <video src="${resolvedSrc}" controls preload="metadata" playsinline class="w-full h-full object-contain bg-black"></video>
    </div>
  `;
}

// Attach hls.js to every <video data-hls-src> that appears in the DOM (renders use innerHTML)
function initHlsVideos(root = document) {
  root.querySelectorAll('video[data-hls-src]:not([data-hls-ready])').forEach(video => {
    video.setAttribute('data-hls-ready', '1');
    const src = video.getAttribute('data-hls-src');
    if (window.Hls && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      video._hls = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    }
  });
}
new MutationObserver(() => initHlsVideos()).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', () => initHlsVideos());

function renderInlineExtraVideosOnCard(record) {
  const extraVideos = Array.isArray(record.extra_videos) ? record.extra_videos : [];
  if (extraVideos.length === 0) return '';
  const firstVid = extraVideos[0];
  return `
    <div class="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1.5" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between text-[11px]">
        <span class="font-bold text-rose-700 flex items-center gap-1">
          <span>🎬 ${firstVid.caption || 'Video Demo'}</span>
        </span>
        ${extraVideos.length > 1 ? `<span class="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 font-semibold text-[10px]">+${extraVideos.length - 1} video khác</span>` : ''}
      </div>
      ${renderVideoPlayerHTML(firstVid.url, 'w-full aspect-video rounded-lg bg-slate-950 overflow-hidden border border-slate-200 shadow-sm')}
    </div>
  `;
}

function renderCustomFieldsHTML(tableName, record, coreFieldNames) {
  const schema = TABLE_SCHEMAS[tableName] || [];
  const customCols = schema.filter(col => !coreFieldNames.includes(col.name) && record[col.name] !== undefined && record[col.name] !== '');
  if (customCols.length === 0) return '';

  return `
    <div class="mt-2.5 pt-2 border-t border-dashed border-slate-200 space-y-1.5 text-xs">
      ${customCols.map(col => {
        const val = record[col.name];
        if (col.type === 'image') {
          return `
            <div>
              <span class="font-bold text-slate-700 block mb-1">${col.label}:</span>
              <div class="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
                <img src="${val}" alt="${col.label}" class="w-auto h-auto max-w-[220px] max-h-32 object-contain block" onerror="this.src='https://placehold.co/200x140/e2e8f0/475569?text=No+Image'" />
              </div>
            </div>
          `;
        }
        if (col.type === 'video') {
          return `
            <div class="space-y-1" onclick="event.stopPropagation()">
              <span class="font-bold text-rose-800 block">🎬 ${col.label}:</span>
              ${renderVideoPlayerHTML(val)}
            </div>
          `;
        }
        if (col.type === 'url') {
          return `<div><strong class="text-slate-800">${col.label}:</strong> <a href="${val}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="text-indigo-700 underline break-all">${val}</a></div>`;
        }
        return `<div><strong class="text-slate-800">${col.label}:</strong> <span class="text-slate-600">${val}</span></div>`;
      }).join('')}
    </div>
  `;
}

// ==========================================
// RENDER FUNCTIONS FOR ALL MAIN TABS (INDEX-BASED, NO ID)
// ==========================================
function renderAllSections() {
  if (!document.getElementById('publicShowcaseView')) { // CMS page: no public sections
    renderCMSTableCountCards();
    lucide.createIcons();
    return;
  }
  renderResources();
  renderPublications();
  renderDemos();
  renderPeople();
  renderNews();
  renderCollaboration();
  renderCMSTableCountCards();
  lucide.createIcons();
}

// 1. RESOURCES -> Datasets, Hardware & Pipelines
function setResourceFilter(type) {
  currentResourceFilter = type;
  document.querySelectorAll('.res-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-filter') === type) {
      btn.className = 'res-filter-btn px-3 py-1.5 rounded-full font-bold bg-[#1e3d54] text-white';
    } else {
      btn.className = 'res-filter-btn px-3 py-1.5 rounded-full font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100';
    }
  });
  renderResources();
}

function renderResources() {
  const container = document.getElementById('resourcesContainer');
  if (!container) return;
  const coreFields = ['item_name', 'resource_type', 'specifications', 'scale_info', 'notes'];
  const indexed = (db.resources || []).map((item, rowIndex) => ({ item, rowIndex }));
  const list = indexed.filter(({ item }) => currentResourceFilter === 'ALL' || item.resource_type === currentResourceFilter);

  container.innerHTML = list.map(({ item, rowIndex }) => {
    const extraImgCount = Array.isArray(item.extra_images) ? item.extra_images.length : 0;
    const extraVidCount = Array.isArray(item.extra_videos) ? item.extra_videos.length : 0;
    const extraLinkCount = Array.isArray(item.extra_links) ? item.extra_links.length : 0;
    const mediaCount = extraImgCount + extraVidCount + extraLinkCount;
    return `
    <div onclick="openItemDetailModal('resources', ${rowIndex})"
      class="emog-card cursor-pointer group rounded-2xl border border-slate-200/90 bg-white p-5 flex flex-col justify-between hover:border-teal-600">
      <div>
        <div class="flex items-center justify-between gap-2">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            item.resource_type === 'Dataset' ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' :
            item.resource_type === 'Hardware Device' ? 'bg-amber-50 text-amber-900 border border-amber-200' :
            'bg-teal-50 text-teal-800 border border-teal-200'
          }">${item.resource_type || ''}</span>
          <span class="text-[11px] font-bold text-teal-700 group-hover:underline">
            Chi tiết ${mediaCount > 0 ? `(+${mediaCount})` : ''} ➔
          </span>
        </div>
        <h3 class="font-extrabold text-slate-900 group-hover:text-teal-800 text-base mt-3 transition">${item.item_name || ''}</h3>
        <div class="mt-2.5 text-xs font-semibold text-[#1e3d54] bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70">
          ${item.scale_info || ''}
        </div>
        <p class="text-xs text-slate-600 mt-2.5 leading-relaxed">${item.specifications || ''}</p>
        ${renderCustomFieldsHTML('resources', item, coreFields)}
        ${renderInlineExtraVideosOnCard(item)}
      </div>
      ${item.notes ? `<div class="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 line-clamp-2">${item.notes}</div>` : ''}
    </div>
  `}).join('') || `<div class="col-span-full text-center py-10 text-xs text-slate-500">Không có tài nguyên nào thuộc phân loại này.</div>`;
}

// 2. PUBLICATIONS -> Completed Reviews & Studies
function renderPublications() {
  const container = document.getElementById('publicationsContainer');
  const filterSelect = document.getElementById('pubFilter');
  if (!container) return;

  const pubCol = (TABLE_SCHEMAS.publications || []).find(c => c.name === 'pub_type');
  const pubOptions = (pubCol && Array.isArray(pubCol.options)) ? pubCol.options : ['Systematic Review', 'Research Study', 'Journal Paper', 'Conference Paper'];
  const currentVal = filterSelect ? filterSelect.value : 'ALL';
  if (filterSelect) {
    filterSelect.innerHTML = `<option value="ALL">Tất cả loại hình</option>` +
      pubOptions.map(o => `<option value="${o}" ${currentVal === o ? 'selected' : ''}>${o}</option>`).join('');
  }

  const indexed = (db.publications || []).map((pub, rowIndex) => ({ pub, rowIndex }));
  const list = indexed.filter(({ pub }) => currentVal === 'ALL' || pub.pub_type === currentVal);
  const coreFields = ['title', 'pub_type', 'domain', 'year', 'authors', 'status'];

  container.innerHTML = list.map(({ pub, rowIndex }) => {
    const extraImgCount = Array.isArray(pub.extra_images) ? pub.extra_images.length : 0;
    const extraVidCount = Array.isArray(pub.extra_videos) ? pub.extra_videos.length : 0;
    const extraLinkCount = Array.isArray(pub.extra_links) ? pub.extra_links.length : 0;
    const mediaCount = extraImgCount + extraVidCount + extraLinkCount;
    return `
    <div onclick="openItemDetailModal('publications', ${rowIndex})"
      class="emog-card cursor-pointer group rounded-2xl border border-slate-200/90 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-500">
      <div class="space-y-1.5 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">${pub.pub_type || ''}</span>
          <span class="text-xs font-bold text-teal-700">${pub.domain || ''}</span>
          <span class="text-xs text-slate-400">• ${pub.year || ''}</span>
        </div>
        <h4 class="font-extrabold text-slate-900 group-hover:text-[#1e3d54] text-sm sm:text-base transition">${pub.title || ''}</h4>
        <div class="text-xs text-slate-500">${pub.authors || 'ANIE Research Group'}</div>
        ${renderCustomFieldsHTML('publications', pub, coreFields)}
        ${renderInlineExtraVideosOnCard(pub)}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">${pub.status || ''}</span>
        <span class="px-3 py-1 rounded-full bg-indigo-50 text-indigo-900 group-hover:bg-[#1e3d54] group-hover:text-white text-xs font-bold transition">
          Chi tiết ${mediaCount > 0 ? `(+${mediaCount})` : ''} ➔
        </span>
      </div>
    </div>
  `}).join('') || `<div class="text-center py-10 text-xs text-slate-500">Chưa có công bố nào trong mục này.</div>`;
}

// 3. DEMO -> Interactive Systems & Prototypes
function renderDemos() {
  const container = document.getElementById('demosContainer');
  if (!container) return;
  const coreFields = ['thumbnail_url', 'video_url', 'name', 'target_condition', 'phase', 'tech_stack', 'status', 'description'];

  container.innerHTML = (db.demos_products || []).map((prod, rowIndex) => {
    const extraImgCount = Array.isArray(prod.extra_images) ? prod.extra_images.length : 0;
    const extraVidCount = (Array.isArray(prod.extra_videos) ? prod.extra_videos.length : 0) + (prod.video_url && prod.video_url.trim() ? 1 : 0);
    const extraLinkCount = Array.isArray(prod.extra_links) ? prod.extra_links.length : 0;
    const thumb = prod.thumbnail_url && prod.thumbnail_url.trim() !== ''
      ? prod.thumbnail_url
      : `https://placehold.co/480x270/1e3d54/ffffff?text=${encodeURIComponent((prod.name || 'ANIE Demo').split(' ').slice(0, 3).join('+'))}`;
    return `
    <div onclick="openItemDetailModal('demos_products', ${rowIndex})"
      class="emog-card cursor-pointer group rounded-2xl border border-slate-200/90 bg-white overflow-hidden flex flex-col justify-between hover:border-teal-600">
      <div>
        <div class="bg-slate-100/80 p-3 flex items-center justify-center border-b border-slate-200/70">
          <div class="inline-flex items-center justify-center rounded-xl overflow-hidden bg-white shadow-sm">
            <img src="${thumb}" alt="${prod.name || ''}" class="w-auto h-auto max-w-full max-h-40 object-contain block" onerror="this.src='https://placehold.co/480x270/1e3d54/ffffff?text=ANIE+Demo'" />
          </div>
        </div>
        <div class="p-5 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-teal-50 text-teal-800 border border-teal-200">${prod.phase || ''}</span>
            <span class="text-[11px] font-bold text-[#1e3d54] group-hover:underline">Xem Demo ➔</span>
          </div>
          <h3 class="font-extrabold text-slate-900 group-hover:text-teal-800 text-base transition">${prod.name || ''}</h3>
          <div class="text-xs font-semibold text-indigo-800">${prod.target_condition || ''}</div>
          <p class="text-xs text-slate-600 leading-relaxed line-clamp-3">${prod.description || ''}</p>
          ${renderCustomFieldsHTML('demos_products', prod, coreFields)}
          ${renderInlineExtraVideosOnCard(prod)}
        </div>
      </div>
      <div class="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 space-y-1 text-[11px]">
        <div class="truncate"><strong class="text-slate-700">Tech:</strong> <span class="text-slate-500">${prod.tech_stack || ''}</span></div>
        <div class="flex items-center justify-between pt-0.5 gap-2">
          <span class="text-emerald-700 font-bold truncate">${prod.status || ''}</span>
          ${extraImgCount + extraVidCount + extraLinkCount > 0 ? `<span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 font-bold shrink-0">${extraVidCount > 0 ? `🎬 ${extraVidCount} video` : `+${extraImgCount} ảnh / ${extraLinkCount} link`}</span>` : ''}
        </div>
      </div>
    </div>
  `}).join('');
}

// 4. TEAM -> 5 Clean Role Groups & Live Counters
function renderPeople() {
  const filterSelect = document.getElementById('peopleFilter');
  const container = document.getElementById('peopleContainer');
  if (!container) return;

  const people = db.people || [];
  const countLeads = people.filter(p => p.role_category === 'Core Leaders').length;
  const countCore = people.filter(p => p.role_category === 'Core Researchers').length;
  const countMasters = people.filter(p =>
    p.role_category === 'Master Students' ||
    p.role_category === 'Master Students - Year 2' ||
    p.role_category === 'Master Students - Year 1'
  ).length;
  const countUndergrads = people.filter(p => p.role_category === 'Undergraduate Students').length;
  const countAlliance = people.filter(p => p.role_category === 'Alliance Cooperatives').length;

  document.getElementById('countCoreLeaders').textContent = String(countLeads).padStart(2, '0');
  document.getElementById('countCoreResearchers').textContent = String(countCore).padStart(2, '0');
  document.getElementById('countMasters').textContent = String(countMasters).padStart(2, '0');
  document.getElementById('countUndergrads').textContent = String(countUndergrads).padStart(2, '0');
  document.getElementById('countAlliance').textContent = String(countAlliance).padStart(2, '0');

  const roleCol = (TABLE_SCHEMAS.people || []).find(c => c.name === 'role_category');
  const roleOptions = (roleCol && Array.isArray(roleCol.options) && roleCol.options.length > 0)
    ? roleCol.options
    : ['Core Leaders', 'Core Researchers', 'Master Students', 'Undergraduate Students', 'Alliance Cooperatives'];

  const currentFilter = filterSelect ? filterSelect.value || 'ALL' : 'ALL';
  if (filterSelect) {
    filterSelect.innerHTML = `<option value="ALL">All Roles</option>` +
      roleOptions.map(opt => `<option value="${opt}" ${currentFilter === opt ? 'selected' : ''}>${opt}</option>`).join('');
  }

  const corePersonFields = ['avatar_url', 'name', 'role_category', 'title', 'academic_rank', 'research_focus', 'email', 'bio'];
  const indexedPeople = people.map((person, rowIndex) => ({ person, rowIndex }));
  let html = '';

  roleOptions.forEach((opt, idx) => {
    if (currentFilter !== 'ALL' && currentFilter !== opt) return;
    const members = indexedPeople.filter(({ person }) =>
      opt === 'Master Students'
        ? (person.role_category === 'Master Students' || person.role_category === 'Master Students - Year 2' || person.role_category === 'Master Students - Year 1')
        : person.role_category === opt
    );
    if (members.length === 0) return;

    const isLeader = opt === 'Core Leaders';
    html += `
      <div class="space-y-3.5">
        <div class="flex items-center justify-between border-l-4 ${isLeader ? 'border-[#1e3d54]' : 'border-teal-600'} pl-3">
          <h3 class="text-base font-extrabold text-slate-900">${idx + 1}. ${opt}</h3>
          <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">${members.length}</span>
        </div>
        <div class="grid grid-cols-1 ${isLeader ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4">
          ${members.map(({ person, rowIndex }) => {
            const displayName = person.name || 'Thành viên ANIE';
            const defaultPlaceholder = `https://placehold.co/240x240/1e3d54/ffffff?text=${encodeURIComponent(displayName.split(' ').slice(0, 2).join('+'))}`;
            const imgSrc = (person.avatar_url && person.avatar_url.trim() !== '') ? person.avatar_url : defaultPlaceholder;
            const mediaCount = (Array.isArray(person.extra_images) ? person.extra_images.length : 0) +
                               (Array.isArray(person.extra_videos) ? person.extra_videos.length : 0) +
                               (Array.isArray(person.extra_links) ? person.extra_links.length : 0);
            return `
            <div onclick="openItemDetailModal('people', ${rowIndex})"
              class="emog-card cursor-pointer group rounded-2xl border ${isLeader ? 'border-slate-300 bg-slate-50/60 p-5' : 'border-slate-200/90 bg-white p-4'} flex flex-col justify-between hover:border-[#1e3d54]">
              <div>
                <div class="flex items-center gap-4">
                  <div class="inline-flex items-center justify-center rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 shadow-sm">
                    <img src="${imgSrc}" alt="${displayName}" class="w-auto h-auto ${isLeader ? 'max-w-[104px] max-h-[96px]' : 'max-w-[88px] max-h-[84px]'} object-contain block" onerror="this.src='https://placehold.co/240x240/1e3d54/ffffff?text=ANIE'" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h4 class="font-extrabold text-slate-900 group-hover:text-[#1e3d54] text-sm leading-snug transition">${displayName}</h4>
                    <div class="text-xs font-semibold text-teal-700 mt-0.5">${person.title || ''}</div>
                    <div class="text-[11px] text-slate-500 mt-0.5">${person.academic_rank || ''}</div>
                  </div>
                </div>
                ${person.research_focus ? `
                <div class="mt-3 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/70 line-clamp-2">
                  ${person.research_focus}
                </div>` : ''}
                ${renderCustomFieldsHTML('people', person, corePersonFields)}
                ${renderInlineExtraVideosOnCard(person)}
              </div>
              <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span class="font-mono truncate">${person.email || ''}</span>
                <span class="font-bold text-[#1e3d54] group-hover:underline shrink-0">Chi tiết ${mediaCount > 0 ? `(+${mediaCount})` : ''} ➔</span>
              </div>
            </div>
          `}).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html || `<div class="text-center py-10 text-xs text-slate-500">Không có nhân sự nào trong phân nhóm này.</div>`;
}

// 5. NEWS -> Lab Updates, Experiments & Milestones
function renderNews() {
  const container = document.getElementById('newsContainer');
  const filterSelect = document.getElementById('newsFilter');
  if (!container) return;

  const indexed = (db.news_collaboration || []).map((item, rowIndex) => ({ item, rowIndex }));
  const newsItems = indexed.filter(({ item }) => item.entry_type !== 'Partner Institution');
  const currentVal = filterSelect ? filterSelect.value : 'ALL';
  const types = ['Experiment Update', 'Project Milestone', 'Seminar & Event'];
  if (filterSelect) {
    filterSelect.innerHTML = `<option value="ALL">Tất cả tin tức</option>` +
      types.map(t => `<option value="${t}" ${currentVal === t ? 'selected' : ''}>${t}</option>`).join('');
  }

  const filtered = newsItems.filter(({ item }) => currentVal === 'ALL' || item.entry_type === currentVal);
  const coreFields = ['cover_url', 'title', 'entry_type', 'date_or_spec', 'summary', 'content'];

  container.innerHTML = filtered.map(({ item, rowIndex }) => {
    const thumb = item.cover_url && item.cover_url.trim() !== ''
      ? item.cover_url
      : `https://placehold.co/480x270/1e3d54/ffffff?text=${encodeURIComponent(item.entry_type || 'ANIE+News')}`;
    const mediaCount = (Array.isArray(item.extra_images) ? item.extra_images.length : 0) +
                       (Array.isArray(item.extra_videos) ? item.extra_videos.length : 0) +
                       (Array.isArray(item.extra_links) ? item.extra_links.length : 0);
    return `
    <div onclick="openItemDetailModal('news_collaboration', ${rowIndex})"
      class="emog-card cursor-pointer group rounded-2xl border border-slate-200/90 bg-white overflow-hidden flex flex-col justify-between hover:border-[#1e3d54]">
      <div>
        <div class="bg-slate-100/80 p-3 flex items-center justify-center border-b border-slate-200/70">
          <div class="inline-flex items-center justify-center rounded-xl overflow-hidden bg-white shadow-sm">
            <img src="${thumb}" alt="${item.title || ''}" class="w-auto h-auto max-w-full max-h-40 object-contain block" onerror="this.src='https://placehold.co/480x270/1e3d54/ffffff?text=ANIE+News'" />
          </div>
        </div>
        <div class="p-5 space-y-2">
          <div class="flex items-center justify-between gap-2 text-[11px]">
            <span class="px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">${item.entry_type || ''}</span>
            <span class="text-slate-500 font-semibold">${item.date_or_spec || ''}</span>
          </div>
          <h3 class="font-extrabold text-slate-900 group-hover:text-[#1e3d54] text-sm sm:text-base leading-snug transition">${item.title || ''}</h3>
          <p class="text-xs text-slate-600 leading-relaxed line-clamp-3">${item.summary || ''}</p>
          ${renderCustomFieldsHTML('news_collaboration', item, coreFields)}
          ${renderInlineExtraVideosOnCard(item)}
        </div>
      </div>
      <div class="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-[11px]">
        <span class="text-slate-400">ANIE Research Group</span>
        <span class="font-bold text-[#1e3d54] group-hover:underline">Đọc chi tiết ${mediaCount > 0 ? `(+${mediaCount})` : ''} ➔</span>
      </div>
    </div>
  `}).join('') || `<div class="col-span-full text-center py-10 text-xs text-slate-500">Chưa có tin tức nào trong phân mục này.</div>`;
}

// 6. COLLABORATION (Shown inside Contact drawer)
function renderCollaboration() {
  const container = document.getElementById('networkingPartnersContainer');
  if (!container) return;
  const indexed = (db.news_collaboration || []).map((item, rowIndex) => ({ item, rowIndex }));
  const partners = indexed.filter(({ item }) => item.entry_type === 'Partner Institution');
  const coreFields = ['cover_url', 'title', 'entry_type', 'date_or_spec', 'summary', 'content'];

  container.innerHTML = partners.map(({ item, rowIndex }) => {
    const mediaCount = (Array.isArray(item.extra_images) ? item.extra_images.length : 0) +
                       (Array.isArray(item.extra_videos) ? item.extra_videos.length : 0) +
                       (Array.isArray(item.extra_links) ? item.extra_links.length : 0);
    return `
    <div onclick="openItemDetailModal('news_collaboration', ${rowIndex})"
      class="emog-card cursor-pointer group rounded-2xl border border-slate-200/90 bg-white p-5 flex items-start justify-between gap-3 hover:border-[#1e3d54]">
      <div class="space-y-1.5 flex-1">
        <div class="flex items-center justify-between gap-2">
          <span class="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 text-[11px] font-bold border border-indigo-200">${item.date_or_spec || ''}</span>
          <span class="text-[11px] font-bold text-[#1e3d54] group-hover:underline">Chi tiết ${mediaCount > 0 ? `(+${mediaCount})` : ''} ➔</span>
        </div>
        <h4 class="font-extrabold text-slate-900 group-hover:text-[#1e3d54] text-sm pt-0.5 transition">${item.title || ''}</h4>
        <p class="text-xs font-semibold text-teal-700">${item.summary || ''}</p>
        <p class="text-xs text-slate-600 line-clamp-2">${item.content || ''}</p>
        ${renderCustomFieldsHTML('news_collaboration', item, coreFields)}
        ${renderInlineExtraVideosOnCard(item)}
      </div>
    </div>
  `}).join('');
}

// ==========================================
// NAVIGATION & ACCESSIBILITY
// ==========================================
function switchSection(sectionKey) {
  document.querySelectorAll('.emog-nav-btn').forEach(btn => btn.classList.remove('active-nav'));
  const activeBtn = document.getElementById('nav-' + sectionKey);
  if (activeBtn) activeBtn.classList.add('active-nav');

  const map = {
    home: 'sec-home',
    resources: 'sec-resources',
    publications: 'sec-publications',
    demo: 'sec-demo',
    teams: 'sec-teams',
    news: 'sec-news',
    contact: 'sec-contact'
  };

  document.querySelectorAll('.portal-section').forEach(sec => sec.classList.add('hidden'));
  const target = document.getElementById(map[sectionKey] || 'sec-home');
  if (target) target.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (typeof closeNavMenu === 'function') closeNavMenu();
  if (typeof replayAOS === 'function') replayAOS(target);
}

function toggleDyslexiaMode() {
  document.body.classList.toggle('dyslexia-mode');
  const isOn = document.body.classList.contains('dyslexia-mode');
  document.getElementById('dyslexiaStatus').textContent = isOn ? 'ON' : 'OFF';
}

function toggleContactPartnerDrawer() {
  const drawer = document.getElementById('contactPartnerDrawer');
  const btn = document.getElementById('btnTogglePartnerDrawer');
  if (!drawer) return;

  const willOpen = drawer.classList.contains('hidden');
  drawer.classList.toggle('hidden');

  if (btn) {
    btn.textContent = willOpen
      ? 'Ẩn biểu mẫu đăng ký hợp tác ▴'
      : 'Hoặc gửi biểu mẫu đăng ký hợp tác ▾';
  }

  if (willOpen) {
    requestAnimationFrame(() => {
      drawer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

// ==========================================
// MEMBER AUTHENTICATION & PORTAL MODE SWITCH
// ==========================================
// The CMS lives on /cms (cms.html); cmsLogout / login UI are defined there.
function logoutMemberPortal() {
  isMemberAuthenticated = false;
  if (typeof cmsLogout === 'function') cmsLogout();
}

function switchPortalMode(mode) {
  currentPortalMode = mode;
  const memberView = document.getElementById('memberCMSWorkspace');
  if (memberView) memberView.classList.toggle('hidden', mode !== 'member');
  if (mode === 'member') {
    selectCMSTable(currentCMSTable);
    renderCMSTableCountCards();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  lucide.createIcons();
}

// ==========================================
// ANIE CMS WORKBENCH & TABLE RENDERER
// ==========================================
function renderCMSTableCountCards() {
  const container = document.getElementById('cmsTableCountCards');
  if (!container) return;
  const meta = [
    { key: 'people', label: 'people', desc: 'Team (Nhân sự)' },
    { key: 'resources', label: 'resources', desc: 'Resources (Dữ liệu & TB)' },
    { key: 'publications', label: 'publications', desc: 'Publications (Công bố)' },
    { key: 'demos_products', label: 'demos_products', desc: 'Demo (Hệ thống)' },
    { key: 'news_collaboration', label: 'news_collaboration', desc: 'News & Đối tác' }
  ];
  container.innerHTML = meta.map(m => `
    <button onclick="selectCMSTable('${m.key}')" class="text-left p-3.5 rounded-xl border ${currentCMSTable === m.key ? 'border-2 border-indigo-900 bg-indigo-50/60' : 'border-slate-200 bg-white'} hover:border-indigo-400 transition">
      <div class="text-xl font-extrabold text-indigo-950">${(db[m.key] || []).length} <span class="text-xs font-semibold text-slate-500">bản ghi</span></div>
      <div class="text-xs font-bold text-slate-800 font-mono mt-0.5 truncate">${m.label}</div>
      <div class="text-[11px] text-slate-500 truncate">${m.desc}</div>
    </button>
  `).join('');
}

function selectCMSTable(tableName) {
  currentCMSTable = tableName;
  document.querySelectorAll('.cms-tab').forEach(btn => {
    btn.className = 'cms-tab px-3.5 py-2 rounded-lg bg-white text-slate-700 border border-slate-300';
  });
  const activeTab = document.getElementById('cms-tab-' + tableName);
  if (activeTab) {
    activeTab.className = 'cms-tab px-3.5 py-2 rounded-lg bg-indigo-900 text-white';
  }
  renderCMSTable();
  renderCMSTableCountCards();
}

function renderCMSTable() {
  const thead = document.getElementById('cmsTableHead');
  const tbody = document.getElementById('cmsTableBody');
  if (!thead || !tbody) return;

  const schema = (TABLE_SCHEMAS[currentCMSTable] || []).filter(c => c.name.toLowerCase() !== 'id');
  const rows = db[currentCMSTable] || [];
  const q = (document.getElementById('cmsSearchInput')?.value || '').toLowerCase().trim();

  const statusEl = document.getElementById('cmsTableStatus');
  if (statusEl) {
    statusEl.textContent = `SELECT * FROM ${currentCMSTable} (${rows.length} rows);`;
  }

  thead.innerHTML = `
    <tr>
      ${schema.map(c => `<th class="p-3 border-r border-slate-200">${c.label} <span class="text-[10px] font-mono text-indigo-700 block">(${c.name})</span></th>`).join('')}
      <th class="p-3 text-right">Thao tác</th>
    </tr>
  `;

  const indexedRows = rows.map((r, idx) => ({ r, idx }));
  const filtered = indexedRows.filter(({ r }) => !q || JSON.stringify(r).toLowerCase().includes(q));

  tbody.innerHTML = filtered.map(({ r, idx }) => `
    <tr class="hover:bg-slate-50">
      ${schema.map(c => {
        const val = r[c.name] !== undefined ? r[c.name] : '';
        if (c.type === 'image') {
          return `<td class="p-3 border-r border-slate-100">
            <div class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white overflow-hidden">
              <img src="${val || 'https://placehold.co/80x80/e2e8f0/475569?text=IMG'}" class="w-auto h-auto max-w-[64px] max-h-[52px] object-contain block" />
            </div>
          </td>`;
        }
        if (c.type === 'video') {
          return `<td class="p-3 border-r border-slate-100">
            ${val ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-semibold text-[11px]">🎬 Đã gắn video</span>` : `<span class="text-slate-400">—</span>`}
          </td>`;
        }
        return `<td class="p-3 border-r border-slate-100 max-w-xs truncate" title="${String(val).replace(/"/g, '&quot;')}">${val}</td>`;
      }).join('')}
      <td class="p-3 text-right whitespace-nowrap space-x-1">
        <button onclick="openItemDetailModal('${currentCMSTable}', ${idx})" class="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold">Ảnh / Video / Link</button>
        <button onclick="openRecordModal('${currentCMSTable}', ${idx})" class="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-semibold">Sửa</button>
        <button onclick="deleteRecord('${currentCMSTable}', ${idx})" class="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold">Xóa</button>
      </td>
    </tr>
  `).join('');
}

// ==========================================
// DYNAMIC SCHEMA MANAGER (ADD / EDIT / REMOVE ANY COLUMN & SELECT OPTIONS)
// ==========================================
function openSchemaModal(tableName) {
  currentCMSTable = tableName;
  stripIdFromAllTables();
  resetSchemaColumnForm();
  document.getElementById('schemaModalTitle').textContent = `Cấu trúc Bảng [${tableName}] – Thêm/Sửa/Xóa Trường & Tùy chọn`;
  document.getElementById('schemaTableBadge').textContent = `TABLE: ${tableName}`;
  renderSchemaFieldsList();
  document.getElementById('schemaModal').classList.remove('hidden');
  lucide.createIcons();
}

function closeSchemaModal() {
  resetSchemaColumnForm();
  document.getElementById('schemaModal').classList.add('hidden');
}

function autoGenerateFieldKey(labelVal) {
  if (editingSchemaColKey) return;
  const keyInput = document.getElementById('newColKey');
  if (!keyInput) return;
  keyInput.value = labelVal
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toggleSelectOptionsInput(typeVal) {
  const wrapper = document.getElementById('newColOptionsWrapper');
  if (wrapper) wrapper.classList.toggle('hidden', typeVal !== 'select');
}

function startEditSchemaField(colName) {
  const schema = TABLE_SCHEMAS[currentCMSTable] || [];
  const col = schema.find(c => c.name === colName);
  if (!col) return;

  editingSchemaColKey = col.name;
  document.getElementById('newColLabel').value = col.label || '';
  const keyInput = document.getElementById('newColKey');
  keyInput.value = col.name;
  keyInput.readOnly = true;
  keyInput.classList.add('bg-slate-100', 'text-slate-500');

  document.getElementById('newColType').value = col.type || 'text';
  document.getElementById('newColDefault').value = col.defaultValue || '';
  document.getElementById('newColRequired').checked = Boolean(col.required);

  toggleSelectOptionsInput(col.type);
  document.getElementById('newColOptions').value = Array.isArray(col.options) ? col.options.join(', ') : '';

  document.getElementById('schemaFormHeading').innerHTML = `
    <i data-lucide="sliders" class="w-4 h-4 text-amber-600"></i>
    <span class="text-amber-900">Đang chỉnh sửa trường [${col.name}]</span>
  `;
  document.getElementById('btnSubmitSchemaColText').textContent = `Lưu cập nhật [${col.name}]`;
  document.getElementById('btnSubmitSchemaCol').className = 'px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 shadow-sm';
  document.getElementById('btnCancelEditCol').classList.remove('hidden');
  lucide.createIcons();
}

function resetSchemaColumnForm() {
  editingSchemaColKey = null;
  const form = document.getElementById('addColumnForm');
  if (form) form.reset();
  const fb = document.getElementById('schemaFormFeedback');
  if (fb) fb.classList.add('hidden');
  const keyInput = document.getElementById('newColKey');
  if (keyInput) {
    keyInput.readOnly = false;
    keyInput.classList.remove('bg-slate-100', 'text-slate-500');
  }
  toggleSelectOptionsInput('text');
  const heading = document.getElementById('schemaFormHeading');
  if (heading) {
    heading.innerHTML = `<i data-lucide="plus-circle" class="w-4 h-4 text-teal-600"></i><span>Bổ sung Trường thông tin mới</span>`;
  }
  const btnText = document.getElementById('btnSubmitSchemaColText');
  if (btnText) btnText.textContent = 'Thêm Trường vào Bảng';
  const btnSubmit = document.getElementById('btnSubmitSchemaCol');
  if (btnSubmit) btnSubmit.className = 'px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 shadow-sm';
  const cancelBtn = document.getElementById('btnCancelEditCol');
  if (cancelBtn) cancelBtn.classList.add('hidden');
  lucide.createIcons();
}

function renderSchemaFieldsList() {
  const schema = (TABLE_SCHEMAS[currentCMSTable] || []).filter(col => col.name.toLowerCase() !== 'id');
  const tbody = document.getElementById('schemaFieldsList');
  if (!tbody) return;
  tbody.innerHTML = schema.map(col => {
    const isSelect = col.type === 'select' && Array.isArray(col.options);
    return `
    <tr class="hover:bg-slate-50 ${editingSchemaColKey === col.name ? 'bg-amber-50/70' : ''}">
      <td class="p-2.5 font-mono font-bold text-indigo-900 align-top">${col.name}</td>
      <td class="p-2.5 align-top">
        <div class="text-slate-800 font-semibold">${col.label}</div>
        ${isSelect ? `<div class="flex flex-wrap gap-1 mt-1.5">${col.options.map(opt => `<span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200 text-[10px] font-semibold">${opt}</span>`).join('')}</div>` : ''}
      </td>
      <td class="p-2.5 align-top whitespace-nowrap">
        <span class="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-mono text-[11px] font-bold uppercase">${col.type}</span>
      </td>
      <td class="p-2.5 text-right align-top whitespace-nowrap">
        <div class="inline-flex items-center justify-end gap-1.5">
          <button type="button" onclick="startEditSchemaField('${col.name}')" class="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold">
            ${isSelect ? 'Sửa tùy chọn / Nhãn' : 'Sửa trường'}
          </button>
          <button type="button" onclick="removeSchemaField('${col.name}')" class="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold">
            Xóa trường
          </button>
        </div>
      </td>
    </tr>
  `}).join('');
}

function handleAddSchemaField(e) {
  e.preventDefault();
  const label = document.getElementById('newColLabel').value.trim();
  const name = document.getElementById('newColKey').value.trim();
  const type = document.getElementById('newColType').value;
  const defaultValue = document.getElementById('newColDefault').value;
  const required = document.getElementById('newColRequired').checked;
  const optionsRaw = document.getElementById('newColOptions').value;
  const fb = document.getElementById('schemaFormFeedback');
  if (!name || !label) return;

  if (name.toLowerCase() === 'id') {
    if (fb) {
      fb.textContent = 'Trường "id" đã bị vô hiệu hóa theo quy định cấu trúc bảng.';
      fb.classList.remove('hidden');
    }
    return;
  }

  if (!Array.isArray(TABLE_SCHEMAS[currentCMSTable])) {
    TABLE_SCHEMAS[currentCMSTable] = JSON.parse(JSON.stringify(DEFAULT_TABLE_SCHEMAS[currentCMSTable] || []));
  }
  if (!Array.isArray(db[currentCMSTable])) {
    db[currentCMSTable] = [];
  }

  const schema = TABLE_SCHEMAS[currentCMSTable];
  const parsedOptions = type === 'select' ? optionsRaw.split(',').map(s => s.trim()).filter(Boolean) : undefined;

  if (editingSchemaColKey) {
    const idx = schema.findIndex(c => c.name === editingSchemaColKey);
    if (idx !== -1) {
      schema[idx] = {
        ...schema[idx],
        label,
        type,
        required,
        defaultValue,
        options: type === 'select' ? (parsedOptions && parsedOptions.length > 0 ? parsedOptions : ['Lựa chọn 1', 'Lựa chọn 2']) : undefined
      };
    }
    resetSchemaColumnForm();
    commitSchemas();
    renderSchemaFieldsList();
    return;
  }

  if (schema.some(c => c.name === name)) {
    if (fb) {
      fb.textContent = `Trường "${name}" đã tồn tại trong bảng này.`;
      fb.classList.remove('hidden');
    }
    return;
  }
  const newCol = { name, label, type, required, defaultValue, core: false };
  if (type === 'select') newCol.options = parsedOptions && parsedOptions.length > 0 ? parsedOptions : ['Lựa chọn 1', 'Lựa chọn 2'];
  schema.push(newCol);

  (db[currentCMSTable] || []).forEach(row => {
    if (row[name] === undefined) row[name] = type === 'number' ? Number(defaultValue || 0) : (defaultValue || '');
  });

  resetSchemaColumnForm();
  commitSchemas();
  renderSchemaFieldsList();
}

function removeSchemaField(colName) {
  if (editingSchemaColKey === colName) {
    resetSchemaColumnForm();
  }
  TABLE_SCHEMAS[currentCMSTable] = (TABLE_SCHEMAS[currentCMSTable] || []).filter(c => c.name !== colName);
  (db[currentCMSTable] || []).forEach(row => {
    if (row && typeof row === 'object') {
      delete row[colName];
    }
  });
  commitSchemas();
  renderSchemaFieldsList();
}

// ==========================================
// ITEM DETAIL POP-UP MODAL (INDEX-BASED, NO ID)
// ==========================================
let currentDetailTable = null;
let currentDetailIndex = null;

function openItemDetailModal(tableName, rowIndex) {
  const record = (db[tableName] || [])[rowIndex];
  if (!record) return;

  currentDetailTable = tableName;
  currentDetailIndex = rowIndex;

  const schema = (TABLE_SCHEMAS[tableName] || []).filter(col => col.name.toLowerCase() !== 'id');
  const titleVal = record.name || record.title || record.item_name || 'Chi tiết bản ghi';
  const badgeVal = record.role_category || record.category || record.pub_type || record.resource_type || record.entry_type || record.phase || tableName;

  document.getElementById('detailModalTitle').textContent = titleVal;
  document.getElementById('detailModalCategoryBadge').textContent = badgeVal;

  const tableRefEl = document.getElementById('detailModalTableRef');
  if (currentPortalMode === 'member') {
    tableRefEl.textContent = `Bảng dữ liệu: ${tableName}`;
    tableRefEl.classList.remove('hidden');
  } else {
    tableRefEl.classList.add('hidden');
  }

  const attrContainer = document.getElementById('detailModalAttributes');
  attrContainer.innerHTML = schema.map(col => {
    const val = record[col.name];
    if (val === undefined || val === null || val === '') return '';
    if (col.type === 'image') {
      return `
        <div class="col-span-1 md:col-span-2 flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div class="inline-flex items-center justify-center rounded-xl overflow-hidden border border-slate-300 bg-white shrink-0">
            <img src="${val}" alt="${col.label}" class="w-auto h-auto max-w-[140px] max-h-[110px] object-contain block" onerror="this.src='https://placehold.co/160x160/1e3d54/ffffff?text=ANIE'" />
          </div>
          <div>
            <div class="text-[11px] font-bold uppercase text-slate-400">${col.label}</div>
            <div class="text-sm font-extrabold text-slate-900 mt-0.5">${titleVal}</div>
          </div>
        </div>
      `;
    }
    if (col.type === 'video') {
      const cleanVideoLabel = col.name === 'video_url' ? 'Video Demo' : col.label.replace(/\s*\(.*?\)\s*/g, '').trim();
      return `
        <div class="col-span-1 md:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
          <div class="text-[11px] font-bold uppercase text-rose-700 flex items-center gap-1.5">
            <span>🎬 ${cleanVideoLabel}</span>
          </div>
          ${renderVideoPlayerHTML(val)}
        </div>
      `;
    }
    if (col.type === 'url') {
      return `
        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div class="text-[11px] font-bold uppercase text-slate-500">${col.label}</div>
          <a href="${val}" target="_blank" rel="noopener" class="text-indigo-700 font-semibold underline break-all mt-0.5 block">${val}</a>
        </div>
      `;
    }
    return `
      <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
        <div class="text-[11px] font-bold uppercase text-slate-500">${col.label}</div>
        <div class="text-slate-900 font-medium mt-0.5 whitespace-pre-line leading-relaxed">${val}</div>
      </div>
    `;
  }).join('');

  // Extended Notes
  const notesEl = document.getElementById('detailModalRichNotes');
  const fallbackNote = record.extended_notes || record.content || record.description || record.notes || record.bio || 'Chưa có thuyết minh bổ sung.';
  notesEl.textContent = fallbackNote;
  const notesInput = document.getElementById('detailExtendedNotesInput');
  if (notesInput) notesInput.value = record.extended_notes || fallbackNote;

  // Extra Images
  const extraImages = Array.isArray(record.extra_images) ? record.extra_images : [];
  const gallerySection = document.getElementById('detailGallerySection');
  const galleryContainer = document.getElementById('detailModalGallery');
  document.getElementById('detailGalleryCount').textContent = `${extraImages.length} hình ảnh`;

  if (extraImages.length === 0 && currentPortalMode !== 'member') {
    gallerySection.classList.add('hidden');
  } else {
    gallerySection.classList.remove('hidden');
    galleryContainer.innerHTML = extraImages.length > 0 ? extraImages.map((img, idx) => `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-2.5 flex flex-col justify-between gap-2">
        <div class="flex items-center justify-center rounded-lg overflow-hidden bg-white border border-slate-200">
          <img src="${img.url}" alt="${img.caption || ''}" class="w-auto h-auto max-w-full max-h-48 object-contain block" onerror="this.src='https://placehold.co/300x200/e2e8f0/475569?text=Image'" />
        </div>
        <div class="flex items-center justify-between gap-2 px-1">
          <span class="text-[11px] font-medium text-slate-700">${img.caption || 'Hình minh họa'}</span>
          ${currentPortalMode === 'member' ? `<button onclick="removeDetailGalleryImage(${idx})" class="text-[11px] text-rose-600 hover:underline font-bold">Xóa</button>` : ''}
        </div>
      </div>
    `).join('') : `<div class="col-span-full text-center py-4 text-slate-400">Chưa có hình ảnh minh họa bổ sung nào.</div>`;
  }

  // Extra Videos
  const extraVideos = Array.isArray(record.extra_videos) ? record.extra_videos : [];
  const videosSection = document.getElementById('detailVideosSection');
  const videosContainer = document.getElementById('detailModalVideos');
  document.getElementById('detailVideosCount').textContent = `${extraVideos.length} video`;

  if (extraVideos.length === 0 && currentPortalMode !== 'member') {
    videosSection.classList.add('hidden');
  } else {
    videosSection.classList.remove('hidden');
    videosContainer.innerHTML = extraVideos.length > 0 ? extraVideos.map((vid, idx) => `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col justify-between gap-2 md:col-span-2">
        ${renderVideoPlayerHTML(vid.url)}
        <div class="flex items-center justify-between gap-2 px-1">
          <span class="text-[11px] font-semibold text-slate-700">${vid.caption || 'Video minh họa'}</span>
          ${currentPortalMode === 'member' ? `<button onclick="removeDetailVideo(${idx})" class="text-[11px] text-rose-600 hover:underline font-bold shrink-0">Xóa</button>` : ''}
        </div>
      </div>
    `).join('') : `<div class="col-span-full text-center py-4 text-slate-400">Chưa có video bổ sung nào.</div>`;
  }

  // Extra Links
  const extraLinks = Array.isArray(record.extra_links) ? record.extra_links : [];
  const linksSection = document.getElementById('detailLinksSection');
  const linksContainer = document.getElementById('detailModalLinks');
  document.getElementById('detailLinksCount').textContent = `${extraLinks.length} liên kết`;

  if (extraLinks.length === 0 && currentPortalMode !== 'member') {
    linksSection.classList.add('hidden');
  } else {
    linksSection.classList.remove('hidden');
    linksContainer.innerHTML = extraLinks.length > 0 ? extraLinks.map((lnk, idx) => `
      <div class="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
        <a href="${lnk.url}" target="_blank" rel="noopener" class="font-bold text-indigo-800 hover:underline truncate flex items-center gap-1.5">
          <span>🔗 ${lnk.label}</span>
        </a>
        ${currentPortalMode === 'member' ? `<button onclick="removeDetailExternalLink(${idx})" class="text-[11px] text-rose-600 hover:underline font-bold shrink-0">Xóa</button>` : ''}
      </div>
    `).join('') : `<div class="col-span-full text-center py-4 text-slate-400">Chưa có liên kết ngoài nào.</div>`;
  }

  // Strict separation: show editor panel ONLY in authenticated ANIE CMS mode
  const editorPanel = document.getElementById('detailMemberEditorPanel');
  const btnEditCore = document.getElementById('btnEditCoreFieldsInModal');
  if (currentPortalMode === 'member' && isMemberAuthenticated) {
    editorPanel.classList.remove('hidden');
    btnEditCore.classList.remove('hidden');
  } else {
    editorPanel.classList.add('hidden');
    btnEditCore.classList.add('hidden');
  }

  document.getElementById('itemDetailModal').classList.remove('hidden');
  lucide.createIcons();
}

function closeItemDetailModal() {
  document.getElementById('itemDetailModal').classList.add('hidden');
}

function openCoreRecordEditorFromDetail() {
  if (currentDetailTable === null || currentDetailIndex === null) return;
  const tbl = currentDetailTable;
  const idx = currentDetailIndex;
  closeItemDetailModal();
  openRecordModal(tbl, idx);
}

function saveDetailExtendedNotes(e) {
  e.preventDefault();
  const record = (db[currentDetailTable] || [])[currentDetailIndex];
  if (!record) return;
  record.extended_notes = document.getElementById('detailExtendedNotesInput').value;
  commitDatabase();
  openItemDetailModal(currentDetailTable, currentDetailIndex);
}

function addDetailGalleryImage(e) {
  e.preventDefault();
  const record = (db[currentDetailTable] || [])[currentDetailIndex];
  if (!record) return;
  const url = document.getElementById('newDetailImgUrl').value.trim();
  const caption = document.getElementById('newDetailImgCaption').value.trim();
  if (!url) return;
  if (!Array.isArray(record.extra_images)) record.extra_images = [];
  record.extra_images.push({ url, caption });
  document.getElementById('newDetailImgUrl').value = '';
  document.getElementById('newDetailImgCaption').value = '';
  commitDatabase();
  openItemDetailModal(currentDetailTable, currentDetailIndex);
}

function removeDetailGalleryImage(idx) {
  const record = (db[currentDetailTable] || [])[currentDetailIndex];
  if (!record || !Array.isArray(record.extra_images)) return;
  record.extra_images.splice(idx, 1);
  commitDatabase();
  openItemDetailModal(currentDetailTable, currentDetailIndex);
}

function addDetailVideo(e) {
  e.preventDefault();
  const record = (db[currentDetailTable] || [])[currentDetailIndex];
  if (!record) return;
  const url = document.getElementById('newDetailVideoUrl').value.trim();
  const caption = document.getElementById('newDetailVideoCaption').value.trim();
  if (!url) return;
  if (!Array.isArray(record.extra_videos)) record.extra_videos = [];
  record.extra_videos.push({ url, caption });
  document.getElementById('newDetailVideoUrl').value = '';
  document.getElementById('newDetailVideoCaption').value = '';
  const statusEl = document.getElementById('newDetailVideoStatus');
  if (statusEl) statusEl.textContent = 'Hỗ trợ YouTube, Vimeo, Drive, MP4';
  commitDatabase();
  openItemDetailModal(currentDetailTable, currentDetailIndex);
}

function removeDetailVideo(idx) {
  const record = (db[currentDetailTable] || [])[currentDetailIndex];
  if (!record || !Array.isArray(record.extra_videos)) return;
  record.extra_videos.splice(idx, 1);
  commitDatabase();
  openItemDetailModal(currentDetailTable, currentDetailIndex);
}

// High-capacity video upload (Server /api/upload-video with progress + fast IndexedDB fallback)
async function handleVideoFileUpload(fileInput, targetInputId, statusElId) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  const statusEl = statusElId ? document.getElementById(statusElId) : null;
  const targetInput = document.getElementById(targetInputId);
  const sizeMB = file.size / (1024 * 1024);

  if (statusEl) {
    statusEl.textContent = `Đang tải video (${sizeMB.toFixed(1)} MB)...`;
    statusEl.className = 'text-[11px] font-semibold text-amber-700';
  }

  // 1. Try uploading to backend server (/api/upload-video) with live % progress & timeout
  let failReason = isServerConnected ? '' : 'chưa kết nối được server (/api/data không phản hồi JSON)';
  if (isServerConnected) {
    const serverUrl = await new Promise((resolveUrl) => {
      const resolve = (url, reason) => { if (!url) failReason = reason || 'lỗi không xác định'; resolveUrl(url); };
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('video', file);

      xhr.open('POST', `${API_BASE}/api/upload-video`, true);
      if (getAuthToken()) xhr.setRequestHeader('Authorization', 'Bearer ' + getAuthToken());
      xhr.timeout = 0; // FFmpeg → HLS conversion can take minutes

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && statusEl) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          statusEl.textContent = `Đang tải lên server: ${pct}% (${sizeMB.toFixed(1)} MB)...`;
        }
      };
      xhr.upload.onload = () => {
        if (statusEl) statusEl.textContent = 'Đang chuyển đổi sang HLS (FFmpeg), vui lòng chờ...';
      };

      xhr.onload = () => {
        let reason = `HTTP ${xhr.status}`;
        try {
          const ct = xhr.getResponseHeader('content-type') || '';
          if (ct.includes('application/json')) {
            const result = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && result.success && result.url) {
              resolve(result.url.startsWith('http') ? result.url : `${API_BASE}${result.url}`);
              return;
            }
            if (result.error) reason = `${result.error} (HTTP ${xhr.status})`;
          } else if (xhr.status === 404) {
            reason = 'server chưa có /api/upload-video – cần restart/deploy bản code mới (HTTP 404)';
          } else if (xhr.status === 413) {
            reason = 'file vượt giới hạn dung lượng của máy chủ/proxy (HTTP 413)';
          }
        } catch (e) { /* fallback */ }
        resolve(null, reason);
      };

      xhr.onerror = () => resolve(null, 'mất kết nối khi tải lên (có thể file quá lớn hoặc server bị ngắt)');
      xhr.ontimeout = () => resolve(null, 'quá thời gian chờ');
      xhr.send(formData);
    });

    if (serverUrl) {
      if (targetInput) targetInput.value = serverUrl;
      if (statusEl) {
        statusEl.textContent = `✓ Đã chuyển sang HLS trên server (${sizeMB.toFixed(1)} MB gốc)`;
        statusEl.className = 'text-[11px] font-semibold text-emerald-700';
      }
      fileInput.value = '';
      return;
    }
  }

  // 2. Instant local playback via Blob URL + non-blocking IndexedDB persistence (with timeout)
  const mediaKey = `idb://video_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const blobUrl = URL.createObjectURL(file);
  inMemoryMediaMap[mediaKey] = blobUrl;

  if (statusEl) {
    statusEl.textContent = `Đang lưu vào bộ nhớ trình duyệt (${sizeMB.toFixed(1)} MB)...`;
  }

  const savedToIDB = await idbSetItem(mediaKey, file, 6000);
  if (savedToIDB) {
    if (targetInput) targetInput.value = mediaKey;
    if (statusEl) {
      statusEl.textContent = `⚠ Chỉ lưu cục bộ trên trình duyệt này (${sizeMB.toFixed(1)} MB) – không tải lên server được: ${failReason}`;
      statusEl.className = 'text-[11px] font-semibold text-amber-700';
      console.warn('[video upload] fallback to IndexedDB:', failReason);
    }
  } else {
    if (targetInput) targetInput.value = blobUrl;
    if (statusEl) {
      statusEl.textContent = `✓ Đã nạp phát ngay (${sizeMB.toFixed(1)} MB – chỉ phiên này)`;
      statusEl.className = 'text-[11px] font-semibold text-teal-700';
    }
  }
  fileInput.value = '';
}

function addDetailExternalLink(e) {
  e.preventDefault();
  const record = (db[currentDetailTable] || [])[currentDetailIndex];
  if (!record) return;
  const label = document.getElementById('newDetailLinkLabel').value.trim();
  const url = document.getElementById('newDetailLinkUrl').value.trim();
  if (!label || !url) return;
  if (!Array.isArray(record.extra_links)) record.extra_links = [];
  record.extra_links.push({ label, url });
  document.getElementById('newDetailLinkLabel').value = '';
  document.getElementById('newDetailLinkUrl').value = '';
  commitDatabase();
  openItemDetailModal(currentDetailTable, currentDetailIndex);
}

function removeDetailExternalLink(idx) {
  const record = (db[currentDetailTable] || [])[currentDetailIndex];
  if (!record || !Array.isArray(record.extra_links)) return;
  record.extra_links.splice(idx, 1);
  commitDatabase();
  openItemDetailModal(currentDetailTable, currentDetailIndex);
}

function handleImageFileUpload(fileInput, targetInputId, previewImgId) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (evt) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const maxDim = 560;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const targetInput = document.getElementById(targetInputId);
      if (targetInput) targetInput.value = dataUrl;
      const previewImg = document.getElementById(previewImgId);
      if (previewImg) previewImg.src = dataUrl;
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

// ==========================================
// RECORD ADD / EDIT / DELETE (INDEX-BASED, NO ID)
// ==========================================
function openRecordModal(tableName, rowIndex = null) {
  editingTable = tableName;
  editingRecordIndex = rowIndex;
  if (!Array.isArray(TABLE_SCHEMAS[tableName]) || TABLE_SCHEMAS[tableName].length === 0) {
    TABLE_SCHEMAS[tableName] = JSON.parse(JSON.stringify(DEFAULT_TABLE_SCHEMAS[tableName] || []));
  }
  if (!Array.isArray(db[tableName])) {
    db[tableName] = [];
  }
  const schema = (TABLE_SCHEMAS[tableName] || []).filter(f => f.name.toLowerCase() !== 'id');
  const record = (rowIndex !== null && rowIndex !== undefined) ? (db[tableName] || [])[rowIndex] : {};

  document.getElementById('recordModalTitle').textContent = (rowIndex !== null && rowIndex !== undefined)
    ? `Cập nhật bản ghi trong [${tableName}]`
    : `Thêm bản ghi mới vào [${tableName}]`;

  const fieldsContainer = document.getElementById('recordFormFields');
  fieldsContainer.innerHTML = schema.map(field => {
    const val = record && record[field.name] !== undefined ? record[field.name] : (field.defaultValue || '');
    if (field.type === 'select') {
      return `
        <div>
          <label class="font-bold text-slate-700 block mb-1">${field.label}</label>
          <select name="${field.name}" class="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white">
            ${(field.options || []).map(opt => `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>
        </div>
      `;
    }
    if (field.type === 'textarea') {
      return `
        <div>
          <label class="font-bold text-slate-700 block mb-1">${field.label}</label>
          <textarea name="${field.name}" rows="3" ${field.required ? 'required' : ''} class="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white">${val}</textarea>
        </div>
      `;
    }
    if (field.type === 'image') {
      const inputId = `img_input_${field.name}`;
      const previewId = `img_prev_${field.name}`;
      const previewSrc = val || 'https://placehold.co/160x160/1e3d54/ffffff?text=Image';
      return `
        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <label class="font-bold text-slate-700 block">${field.label}</label>
          <div class="flex items-center gap-3">
            <div class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white overflow-hidden shrink-0">
              <img id="${previewId}" src="${previewSrc}" alt="Preview" class="w-auto h-auto max-w-[84px] max-h-[72px] object-contain block" />
            </div>
            <div class="flex-1 space-y-1.5">
              <label class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-900 hover:bg-indigo-800 text-white font-semibold cursor-pointer text-xs">
                <span>📁 Chọn ảnh từ máy tính</span>
                <input type="file" accept="image/*" class="hidden" onchange="handleImageFileUpload(this, '${inputId}', '${previewId}')" />
              </label>
              <input id="${inputId}" name="${field.name}" type="text" value="${val}" placeholder="Hoặc dán đường dẫn URL hình ảnh..." oninput="document.getElementById('${previewId}').src = this.value || 'https://placehold.co/160x160/1e3d54/ffffff?text=Image'" class="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white text-[11px]" />
            </div>
          </div>
        </div>
      `;
    }
    if (field.type === 'video') {
      const inputId = `vid_input_${field.name}`;
      const statusId = `vid_status_${field.name}`;
      return `
        <div class="p-3 rounded-xl bg-rose-50/50 border border-rose-200 space-y-2">
          <label class="font-bold text-slate-700 block">🎬 ${field.label}</label>
          <div class="flex flex-wrap items-center gap-2">
            <label class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-semibold cursor-pointer text-xs">
              <span>🎬 Chọn file video từ máy</span>
              <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" class="hidden" onchange="handleVideoFileUpload(this, '${inputId}', '${statusId}')" />
            </label>
            <span id="${statusId}" class="text-[11px] text-slate-500">Hỗ trợ YouTube, Vimeo, Drive, MP4</span>
          </div>
          <input id="${inputId}" name="${field.name}" type="text" value="${String(val).replace(/"/g, '&quot;')}" placeholder="Hoặc dán link YouTube, Vimeo, Google Drive, hay URL (.mp4)..." class="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white text-[11px] font-mono" />
        </div>
      `;
    }
    return `
      <div>
        <label class="font-bold text-slate-700 block mb-1">${field.label}</label>
        <input name="${field.name}" type="${field.type === 'number' ? 'number' : (field.type === 'date' ? 'date' : 'text')}" value="${String(val).replace(/"/g, '&quot;')}" ${field.required ? 'required' : ''} class="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white" />
      </div>
    `;
  }).join('');

  document.getElementById('recordModal').classList.remove('hidden');
}

function closeRecordModal() {
  document.getElementById('recordModal').classList.add('hidden');
  editingRecordIndex = null;
  editingTable = null;
}

function saveRecordForm(e) {
  e.preventDefault();
  if (!Array.isArray(db[editingTable])) {
    db[editingTable] = [];
  }
  const formData = new FormData(e.target);
  const schema = (TABLE_SCHEMAS[editingTable] || []).filter(f => f.name.toLowerCase() !== 'id');
  const payload = {};

  schema.forEach(field => {
    payload[field.name] = field.type === 'number'
      ? Number(formData.get(field.name) || 0)
      : formData.get(field.name);
  });

  if (editingRecordIndex !== null && editingRecordIndex !== undefined && db[editingTable][editingRecordIndex]) {
    db[editingTable][editingRecordIndex] = { ...db[editingTable][editingRecordIndex], ...payload };
  } else {
    db[editingTable].push({ ...payload });
  }

  commitDatabase();
  closeRecordModal();
}

function deleteRecord(tableName, rowIndex) {
  if (!Array.isArray(db[tableName])) return;
  db[tableName].splice(rowIndex, 1);
  commitDatabase();
}

async function submitQuickPartnerForm(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    name: document.getElementById('quickPartnerName').value.trim(),
    spec: document.getElementById('quickPartnerSpec').value,
    contact: document.getElementById('quickPartnerScale').value.trim(),
    notes: document.getElementById('quickPartnerNotes').value.trim()
  };
  const btn = form.querySelector('button[type="submit"]');
  const fb = document.getElementById('partnerSubmitFeedback');
  const showFeedback = (msg, ok) => {
    if (!fb) return;
    fb.textContent = msg;
    fb.className = 'text-xs font-semibold rounded-lg p-2.5 text-center border ' +
      (ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200');
    setTimeout(() => fb.classList.add('hidden'), 5000);
  };
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/partner-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) throw new Error(result.error || `HTTP ${res.status}`);
    if (!Array.isArray(db.news_collaboration)) db.news_collaboration = [];
    db.news_collaboration.push({
      cover_url: '', title: payload.name, entry_type: 'Partner Institution',
      date_or_spec: payload.spec, summary: payload.contact, content: payload.notes
    });
    form.reset();
    renderAllSections();
    showFeedback('Đã ghi nhận thông tin liên hệ & đăng ký hợp tác thành công!', true);
  } catch (err) {
    showFeedback('Không gửi được: ' + err.message, false);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ==========================================
// MULTI-FORMAT EXPORT (EXCEL / CSV / JSON - NO ID)
// ==========================================
function toggleExportMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('exportDropdownMenu');
  if (menu) menu.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('exportDropdownWrapper');
  const menu = document.getElementById('exportDropdownMenu');
  if (wrapper && menu && !wrapper.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

function exportDataFormat(format) {
  const menu = document.getElementById('exportDropdownMenu');
  if (menu) menu.classList.add('hidden');

  if (format === 'json') exportDatabaseJSON();
  else if (format === 'csv') exportCurrentTableCSV();
  else if (format === 'excel') exportAllTablesExcel();
}

function exportDatabaseJSON() {
  stripIdFromAllTables();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(db, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute('href', dataStr);
  dlAnchor.setAttribute('download', 'anie_cms_database.json');
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function exportCurrentTableCSV() {
  stripIdFromAllTables();
  const tableName = currentCMSTable || 'people';
  const schema = (TABLE_SCHEMAS[tableName] || []).filter(c => c.name.toLowerCase() !== 'id');
  const rows = db[tableName] || [];

  const headers = schema.map(c => c.label || c.name);
  const keys = schema.map(c => c.name);

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    return `"${String(val).replace(/"/g, '""')}"`;
  };

  const csvLines = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => keys.map(k => escapeCSV(row[k])).join(','))
  ];

  const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dlAnchor = document.createElement('a');
  dlAnchor.href = url;
  dlAnchor.setAttribute('download', `anie_${tableName}_export.csv`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
  URL.revokeObjectURL(url);
}

function exportAllTablesExcel() {
  stripIdFromAllTables();
  const escapeXml = (unsafe) => {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const worksheetsXml = Object.keys(TABLE_SCHEMAS).map(tableName => {
    const schema = (TABLE_SCHEMAS[tableName] || []).filter(c => c.name.toLowerCase() !== 'id');
    const rows = db[tableName] || [];
    const sheetName = tableName.substring(0, 31);

    const headerCells = schema.map(c => c.label || c.name)
      .map(h => `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
      .join('');

    const dataRows = rows.map(row => {
      const colCells = schema.map(c => {
        const val = row[c.name] !== undefined && row[c.name] !== null ? row[c.name] : '';
        const isNum = c.type === 'number' && !isNaN(Number(val)) && val !== '';
        return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(val)}</Data></Cell>`;
      }).join('');
      return `<Row>${colCells}</Row>`;
    }).join('');

    return `
      <Worksheet ss:Name="${escapeXml(sheetName)}">
        <Table>
          <Row>${headerCells}</Row>
          ${dataRows}
        </Table>
      </Worksheet>
    `;
  }).join('');

  const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
   <Font ss:FontName="Arial" ss:Size="10"/>
  </Style>
  <Style ss:ID="sHeader">
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E3D54" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 ${worksheetsXml}
</Workbook>`;

  const blob = new Blob([workbookXml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dlAnchor = document.createElement('a');
  dlAnchor.href = url;
  dlAnchor.setAttribute('download', 'anie_cms_database.xls');
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
  URL.revokeObjectURL(url);
}

function resetDatabaseToSeed() {
  TABLE_SCHEMAS = JSON.parse(JSON.stringify(DEFAULT_TABLE_SCHEMAS));
  db = JSON.parse(JSON.stringify(INITIAL_SEED_DB));
  stripIdFromAllTables();
  commitSchemas();
}

// ==========================================
// HEADER RIGHT LOGOS MANAGEMENT (FIT & UET - SERVER API + URL INPUT + LOCAL FALLBACK)
// ==========================================
const HEADER_LOGO_KEY_1 = 'anie_header_right_logo_1';
const HEADER_LOGO_KEY_2 = 'anie_header_right_logo_2';
const API_BASE_URL = window.location.origin;

function showLogoFeedback(msg) {
  const banner = document.getElementById('logoFeedbackBanner');
  if (!banner) return;
  banner.textContent = msg;
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 3500);
}

async function applySavedHeaderLogos() {
  let logo1Url = null;
  let logo2Url = null;

  if (isServerConnected) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/data`);
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const result = await response.json();
        if (result.success && result.settings) {
          logo1Url = result.settings.logo1_url;
          logo2Url = result.settings.logo2_url;
        }
      }
    } catch (err) {
      // Fallback to localStorage
    }
  }

  if (!logo1Url) logo1Url = localStorage.getItem(HEADER_LOGO_KEY_1);
  if (!logo2Url) logo2Url = localStorage.getItem(HEADER_LOGO_KEY_2);

  const img1 = document.getElementById('headerRightLogo1');
  const svg1 = document.getElementById('headerRightSvg1');
  const img2 = document.getElementById('headerRightLogo2');
  const svg2 = document.getElementById('headerRightSvg2');

  if (logo1Url && img1 && svg1) {
    img1.src = (logo1Url.startsWith('http') || logo1Url.startsWith('data:')) ? logo1Url : `${API_BASE_URL}${logo1Url}`;
    img1.classList.remove('hidden');
    svg1.classList.add('hidden');
  } else if (img1 && svg1) {
    img1.classList.add('hidden');
    svg1.classList.remove('hidden');
  }

  if (logo2Url && img2 && svg2) {
    img2.src = (logo2Url.startsWith('http') || logo2Url.startsWith('data:')) ? logo2Url : `${API_BASE_URL}${logo2Url}`;
    img2.classList.remove('hidden');
    svg2.classList.add('hidden');
  } else if (img2 && svg2) {
    img2.classList.add('hidden');
    svg2.classList.remove('hidden');
  }

  const input1 = document.getElementById('logo1UrlInput');
  const input2 = document.getElementById('logo2UrlInput');

  if (input1 && logo1Url) {
    input1.value = logo1Url.startsWith('http') ? logo1Url : '';
    previewLogoUrl(1, logo1Url);
  }

  if (input2 && logo2Url) {
    input2.value = logo2Url.startsWith('http') ? logo2Url : '';
    previewLogoUrl(2, logo2Url);
  }
}

function saveLogoFileLocally(file, slot) {
  const reader = new FileReader();
  reader.onload = function (evt) {
    const dataUrl = evt.target.result;
    const key = slot === 1 ? HEADER_LOGO_KEY_1 : HEADER_LOGO_KEY_2;
    localStorage.setItem(key, dataUrl);
    previewLogoUrl(slot, dataUrl);
    applySavedHeaderLogos();
    showLogoFeedback(`Logo ${slot} đã được tải lên và hiển thị thành công!`);
  };
  reader.readAsDataURL(file);
}

async function uploadHeaderLogo(fileInput, slot) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  if (!isServerConnected) {
    saveLogoFileLocally(file, slot);
    return;
  }

  const formData = new FormData();
  formData.append('logo', file);
  formData.append('slot', slot);

  try {
    const response = await fetch(`${API_BASE_URL}/api/upload-logo`, {
      method: 'POST',
      body: formData
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) {
      throw new Error('Upload API returned non-JSON response');
    }

    const result = await response.json();

    if (result.success) {
      const settingKey = slot === 1 ? 'logo1_url' : 'logo2_url';
      await fetch(`${API_BASE_URL}/api/settings/${settingKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: result.url })
      });

      const reader = new FileReader();
      reader.onload = function (evt) {
        const key = slot === 1 ? HEADER_LOGO_KEY_1 : HEADER_LOGO_KEY_2;
        localStorage.setItem(key, evt.target.result);

        const inputId = slot === 1 ? 'logo1UrlInput' : 'logo2UrlInput';
        const input = document.getElementById(inputId);
        if (input) {
          input.value = result.url.startsWith('http') ? result.url : `${API_BASE_URL}${result.url}`;
          previewLogoUrl(slot, evt.target.result);
        }
      };
      reader.readAsDataURL(file);

      await applySavedHeaderLogos();
      showLogoFeedback('Logo đã được tải lên thành công!');
    } else {
      saveLogoFileLocally(file, slot);
    }
  } catch (err) {
    saveLogoFileLocally(file, slot);
  }
}

function previewLogoUrl(slot, fallbackDataUrl = null) {
  const inputId = slot === 1 ? 'logo1UrlInput' : 'logo2UrlInput';
  const previewId = slot === 1 ? 'logo1Preview' : 'logo2Preview';
  const inputEl = document.getElementById(inputId);
  const url = inputEl ? inputEl.value.trim() : '';
  const preview = document.getElementById(previewId);
  if (!preview) return;

  if (url && url !== '') {
    preview.src = url;
  } else if (fallbackDataUrl) {
    preview.src = fallbackDataUrl;
  } else {
    const stored = localStorage.getItem(slot === 1 ? HEADER_LOGO_KEY_1 : HEADER_LOGO_KEY_2);
    preview.src = stored || (slot === 1 ? 'https://placehold.co/40x40/e2e8f0/64748b?text=Logo1' : 'https://placehold.co/40x40/e2e8f0/64748b?text=Logo2');
  }
}

async function saveLogoUrl(slot) {
  const inputId = slot === 1 ? 'logo1UrlInput' : 'logo2UrlInput';
  const url = document.getElementById(inputId).value.trim();
  const settingKey = slot === 1 ? 'logo1_url' : 'logo2_url';

  if (!url || url === '') {
    showLogoFeedback('Vui lòng nhập URL hình ảnh!');
    return;
  }

  const key = slot === 1 ? HEADER_LOGO_KEY_1 : HEADER_LOGO_KEY_2;
  localStorage.setItem(key, url);

  if (isServerConnected) {
    try {
      await fetch(`${API_BASE_URL}/api/settings/${settingKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: url })
      });
    } catch (err) {
      // Fallback to localStorage
    }
  }

  await applySavedHeaderLogos();
  showLogoFeedback(`Logo ${slot} đã được lưu thành công!`);
}

async function resetHeaderLogos() {
  if (isServerConnected) {
    try {
      await fetch(`${API_BASE_URL}/api/logo/1`, { method: 'DELETE' });
      await fetch(`${API_BASE_URL}/api/logo/2`, { method: 'DELETE' });
    } catch (err) {
      // Ignore server error
    }
  }

  localStorage.removeItem(HEADER_LOGO_KEY_1);
  localStorage.removeItem(HEADER_LOGO_KEY_2);

  const input1 = document.getElementById('logo1UrlInput');
  const input2 = document.getElementById('logo2UrlInput');
  if (input1) input1.value = '';
  if (input2) input2.value = '';
  previewLogoUrl(1);
  previewLogoUrl(2);

  await applySavedHeaderLogos();
  showLogoFeedback('Đã khôi phục Logo mặc định!');
}

// Initialize Portal (public page: on load; CMS page: after a successful login)
async function initPortal() {
  await loadFromServer();
  await applySavedHeaderLogos();
  renderAllSections();
  renderCMSTable();
  renderCMSTableCountCards();
}
if (window.ANIE_PAGE !== 'cms') window.addEventListener('DOMContentLoaded', initPortal);