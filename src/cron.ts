import { startLegendaryTasks } from '@/fishing';


export function startCron() {
    startLegendaryTasks()
    console.log('Cron jobs started');
}