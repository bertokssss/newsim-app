import SchedulesClient from './SchedulesClient';

export const metadata = {
  title: 'Training Schedule | NEWSIM Trainee Portal',
  description: 'View daily and weekly maritime simulator and classroom training timetable.',
};

export default function SchedulesPage() {
  return <SchedulesClient />;
}
