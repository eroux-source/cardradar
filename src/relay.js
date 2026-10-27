// The relay container (relay/Dockerfile): a tiny Node server the crawler uses to reach
// retailers through the residential proxy. Two instances at most, asleep after 10 idle minutes.
import { Container } from '@cloudflare/containers';

export class Relay extends Container {
  defaultPort = 8080;
  sleepAfter = '10m';
}
