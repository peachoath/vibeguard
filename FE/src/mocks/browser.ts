import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// 브라우저(dev) 환경용 MSW 워커. 활성화하려면 main.tsx에서 worker.start() 호출.
export const worker = setupWorker(...handlers)
