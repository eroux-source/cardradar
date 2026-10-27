// The relay container (relay/Dockerfile): a tiny Node server the crawler uses to reach
// retailers through the residential proxy. Durable Object-managed container: the image is
// named in wrangler.toml (`images.relay`) and must be passed when the container starts.
import { Container } from '@cloudflare/containers';

export class Relay extends Container {
  defaultPort = 8080;
  sleepAfter = '10m';

  constructor(ctx, env) {
    super(ctx, env);
    const c = ctx.container;
    if (c && typeof c.start === 'function') {
      const start = c.start.bind(c);
      c.start = (cfg = {}) => {
        const imgs = c.images ?? {};
        const image = imgs.relay ?? Object.values(imgs)[0];
        if (!image) throw new Error(`no image (images: ${JSON.stringify(Object.keys(imgs))}, type ${typeof c.images})`);
        return start({ ...cfg, image });
      };
    }
  }
}
