let i = 0;
while (i < 5000000) {
  process.stdout.write(`Line ${i}: Generando un log largo y pesado para probar el buffer circular y el backpressure de WriteStream. [DATA: ${'x'.repeat(100)}]\n`);
  i++;
}
