import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';
import {
  AnalyticsEventProperties,
  AnalyticsGroup,
} from './analytics.interfaces';

@Injectable()
export class AnalyticsService implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsService.name);
  private posthog: PostHog | null = null;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('analytics.posthogApiKey');
    const host = this.configService.get<string>('analytics.posthogHost');
    this.enabled =
      this.configService.get<boolean>('analytics.enabled') ?? false;

    if (this.enabled && apiKey && host) {
      this.posthog = new PostHog(apiKey, {
        host,
        flushAt: 1, // Flush after every event (useful for development/debugging)
        flushInterval: 1000, // Flush every second
      });
      this.logger.log(`PostHog analytics initialized (host: ${host})`);
      this.logger.log(`PostHog API key: ${apiKey.substring(0, 10)}...`);
    } else {
      this.logger.warn(
        'PostHog analytics not configured or disabled. Analytics will be skipped.',
      );
      this.logger.warn(
        `Config: enabled=${this.enabled}, apiKey=${!!apiKey}, host=${!!host}`,
      );
    }
  }

  /**
   * Get the PostHog client instance for direct use
   * Useful for integrating with OpenAI wrapper
   */
  getClient(): PostHog | null {
    return this.posthog;
  }

  /**
   * Check if analytics is enabled and configured
   */
  isEnabled(): boolean {
    return this.enabled && this.posthog !== null;
  }

  /**
   * Capture a custom event
   */
  capture(
    distinctId: string,
    event: string,
    properties?: AnalyticsEventProperties,
    groups?: AnalyticsGroup,
  ): void {
    if (!this.isEnabled() || !this.posthog) {
      return;
    }

    try {
      this.posthog.capture({
        distinctId,
        event,
        properties,
        groups,
      });
      this.logger.debug(
        `📊 Analytics event captured: ${event} (user: ${distinctId})`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to capture analytics event: ${errorMessage}`);
    }
  }

  /**
   * Identify a user with their properties
   */
  identify(distinctId: string, properties?: AnalyticsEventProperties): void {
    if (!this.isEnabled() || !this.posthog) {
      return;
    }

    try {
      this.posthog.identify({
        distinctId,
        properties,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to identify user', errorMessage);
    }
  }

  /**
   * Associate a user with a group
   */
  group(
    distinctId: string,
    groupType: string,
    groupKey: string,
    properties?: AnalyticsEventProperties,
  ): void {
    if (!this.isEnabled() || !this.posthog) {
      return;
    }

    try {
      this.posthog.groupIdentify({
        groupType,
        groupKey,
        properties,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to set group', errorMessage);
    }
  }

  /**
   * Flush all pending events before shutdown
   */
  async onModuleDestroy(): Promise<void> {
    if (this.posthog) {
      this.logger.log('Shutting down PostHog client...');
      await this.posthog.shutdown();
      this.logger.log('PostHog client shutdown complete');
    }
  }
}
