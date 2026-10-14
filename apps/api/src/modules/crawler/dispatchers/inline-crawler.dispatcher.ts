import { Injectable, Logger } from '@nestjs/common';
import { CrawlerRunner } from '../services/crawler-runner.service';
import { CrawlerCommand } from '../interfaces/crawler-run.interface';
import { CrawlerDispatcher } from './crawler-dispatcher.interface';

/**
 * API 프로세스 안에서 바로 실행 (워커 없이 로컬 개발할 때 사용).
 * Cloud Run처럼 요청이 끝나면 CPU가 회수되는 환경에서는 사용하지 않는다.
 */
@Injectable()
export class InlineCrawlerDispatcher implements CrawlerDispatcher {
  private readonly logger = new Logger(InlineCrawlerDispatcher.name);

  constructor(private readonly runner: CrawlerRunner) {}

  dispatch(command: CrawlerCommand): Promise<void> {
    // 응답을 기다리게 하지 않도록 await 하지 않고 백그라운드로 실행
    this.runner.execute(command).catch((err) => {
      this.logger.error(`Inline crawler command ${command.type} failed`, err);
    });
    return Promise.resolve();
  }
}
