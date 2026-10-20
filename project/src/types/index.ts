export interface Subject {
  id: string;
  code: string;
  name: string;
  department: string;
  description: string | null;
  created_at: string;
}

export interface Tutor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  year_level: string | null;
  status: string;
  rating: number;
  availability_date: string | null;
  availability_start_time: string | null;
  availability_end_time: string | null;
  tutoring_method: string | null;
  meeting_details: string | null;
  created_at: string;
}

export interface TutorSubject {
  id: string;
  tutor_id: string;
  subject_id: string;
  tutor?: Tutor;
  subject?: Subject;
}

export interface Session {
  id: string;
  tutor_id: string;
  subject_id: string;
  student_name: string;
  student_email: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  tutor?: Tutor;
  subject?: Subject;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  condition_status: string;
  location: string | null;
  created_at: string;
}

export interface InventoryTransaction {
  id: string;
  item_id: string;
  transaction_type: string;
  quantity: number;
  reason: string | null;
  created_at: string;
  item?: InventoryItem;
}

export interface Profile {
  id: string;
  full_name: string;
  role: 'user' | 'staff' | 'tutor' | 'admin';
  phone: string | null;
  account_status: string;
  rejected_reason: string | null;
  is_first_admin: boolean;
  created_at: string;
}

export interface RoleChangeRequest {
  id: string;
  requester_id: string;
  requested_role: 'staff' | 'tutor';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Workshop {
  id: string;
  title: string;
  description: string | null;
  tutor_id: string | null;
  workshop_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  capacity: number;
  status: string;
  created_at: string;
  tutor?: Tutor;
  enrollments?: WorkshopEnrollment[];
}

export interface WorkshopEnrollment {
  id: string;
  workshop_id: string;
  student_name: string;
  student_email: string | null;
  status: string;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string | null;
  category: string;
  stock: number;
  cover_image_url: string | null;
  status: string;
  created_at: string;
}
