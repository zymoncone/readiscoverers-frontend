import { useEffect, useRef } from 'react';
import p5 from 'p5';

const BackgroundAnimation = () => {
  const canvasRef = useRef(null);
  const p5Instance = useRef(null);

  useEffect(() => {
    const sketch = (p) => {
      let particles = [];
      const particleCount = 25;
      let bookPages = [];
      const pageCount = 15;

      const drawGradientBackground = () => {
        // Dark blue/light aesthetic gradient
        const time = p.frameCount * 0.0008;

        p.noStroke();

        // Create soft flowing orbs in blue/indigo tones
        for (let i = 0; i < 4; i++) {
          const angle = time + i * 1.5;
          const x = p.width / 2 + p.cos(angle) * 120;
          const y = p.height / 2 + p.sin(angle * 0.8) * 100;
          const hue = 230 + p.sin(time + i) * 15; // Blue/indigo range

          for (let r = 700; r > 0; r -= 60) {
            const alpha = p.map(r, 0, 700, 6, 0);
            p.fill(hue, 25, 92, alpha);
            p.ellipse(x, y, r, r);
          }
        }

        // Base light blue-grey background
        p.fill(220, 12, 98); // Very light blue-grey
        p.rect(0, 0, p.width, p.height);
      };

      class BookPage {
        constructor() {
          this.x = p.random(p.width);
          this.y = p.random(-p.height, p.height);
          this.width = p.random(20, 40);
          this.height = this.width * 1.4; // Book page proportions
          this.rotation = p.random(-0.2, 0.2);
          this.rotationSpeed = p.random(-0.005, 0.005);
          this.speedY = p.random(0.2, 0.5);
          this.speedX = p.random(-0.1, 0.1);
          this.flutter = p.random(0, p.TWO_PI);
          this.opacity = p.random(60, 85);
          // Colorful book covers - full spectrum
          this.hue = p.random(0, 360);
          this.saturation = p.random(60, 90);
          this.brightness = p.random(70, 95);
        }

        update() {
          this.y += this.speedY;
          this.x += this.speedX + p.sin(this.flutter) * 0.3;
          this.rotation += this.rotationSpeed;
          this.flutter += 0.02;

          // Reset when off screen
          if (this.y > p.height + 50) {
            this.y = -50;
            this.x = p.random(p.width);
          }

          // Wrap horizontally
          if (this.x < -50) this.x = p.width + 50;
          if (this.x > p.width + 50) this.x = -50;
        }

        display() {
          p.push();
          p.translate(this.x, this.y);
          p.rotate(this.rotation);

          // Page shadow
          p.fill(0, 0, 0, 15);
          p.noStroke();
          p.rect(2, 2, this.width, this.height, 2);

          // Colorful book cover
          p.fill(this.hue, this.saturation, this.brightness, this.opacity);
          p.rect(0, 0, this.width, this.height, 2);

          // Subtle spine or accent line
          p.stroke(this.hue, this.saturation + 10, this.brightness - 20, this.opacity);
          p.strokeWeight(1.5);
          p.line(this.width * 0.15, 0, this.width * 0.15, this.height);

          // Title lines on book cover (slightly darker)
          p.stroke(this.hue, this.saturation + 5, this.brightness - 30, this.opacity * 0.7);
          p.strokeWeight(0.8);
          const lineCount = 3;
          for (let i = 0; i < lineCount; i++) {
            const y = (this.height / (lineCount + 2)) * (i + 1);
            const lineWidth = this.width * p.random(0.4, 0.7);
            p.line(this.width * 0.25, y, this.width * 0.25 + lineWidth, y);
          }

          p.pop();
        }
      }

      class Particle {
        constructor() {
          this.x = p.random(p.width);
          this.y = p.random(p.height);
          this.size = p.random(1, 3);
          this.speedX = p.random(-0.2, 0.2);
          this.speedY = p.random(-0.2, 0.2);
          this.opacity = p.random(20, 40);
          // Blue/indigo theme
          this.hue = p.random(220, 250);
          this.saturation = p.random(20, 40);
          this.brightness = p.random(60, 75);
        }

        update() {
          this.x += this.speedX;
          this.y += this.speedY;

          // Wrap around edges
          if (this.x < 0) this.x = p.width;
          if (this.x > p.width) this.x = 0;
          if (this.y < 0) this.y = p.height;
          if (this.y > p.height) this.y = 0;

          // Subtle floating motion
          this.y += p.sin(p.frameCount * 0.01 + this.x * 0.01) * 0.15;
        }

        display() {
          p.noStroke();
          p.fill(this.hue, this.saturation, this.brightness, this.opacity);
          p.circle(this.x, this.y, this.size);
        }

        connectTo(other) {
          const d = p.dist(this.x, this.y, other.x, other.y);
          if (d < 120) {
            const alpha = p.map(d, 0, 120, 15, 0);
            p.stroke(40, 25, 65, alpha);
            p.strokeWeight(0.3);
            p.line(this.x, this.y, other.x, other.y);
          }
        }
      }

      p.setup = () => {
        p.createCanvas(window.innerWidth, window.innerHeight);
        p.colorMode(p.HSB, 360, 100, 100, 100);

        // Create book pages
        for (let i = 0; i < pageCount; i++) {
          bookPages.push(new BookPage());
        }

        // Create particles (dust motes)
        for (let i = 0; i < particleCount; i++) {
          particles.push(new Particle());
        }
      };

      p.draw = () => {
        // Animated gradient background
        drawGradientBackground();

        // Update and display book pages
        for (let page of bookPages) {
          page.update();
          page.display();
        }

        // Update and display particles (dust motes)
        for (let i = 0; i < particles.length; i++) {
          particles[i].update();
          particles[i].display();

          // Draw connections to nearby particles
          for (let j = i + 1; j < particles.length; j++) {
            particles[i].connectTo(particles[j]);
          }
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
      };
    };

    // Create p5 instance
    p5Instance.current = new p5(sketch, canvasRef.current);

    // Cleanup
    return () => {
      if (p5Instance.current) {
        p5Instance.current.remove();
      }
    };
  }, []);

  return (
    <div
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        opacity: 0.6
      }}
    />
  );
};

export default BackgroundAnimation;
