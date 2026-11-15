import GradesClient from './GradesClient';

export const metadata = {
  title: 'Grades & Evaluation Scores | NEWSIM Trainee Portal',
  description: 'View released assessment grades, scores, and instructor feedback.',
};

export default function GradesPage() {
  return <GradesClient />;
}
