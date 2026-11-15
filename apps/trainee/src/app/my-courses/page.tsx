import MyCoursesClient from './MyCoursesClient';

export const metadata = {
  title: 'My Enrolled Courses | NEWSIM Trainee Portal',
  description: 'View active STCW maritime training courses, syllabus, and module progress.',
};

export default function MyCoursesPage() {
  return <MyCoursesClient />;
}
