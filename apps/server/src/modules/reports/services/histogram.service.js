export class HistogramService {
  /**
   * Transforma los datos crudos de valoraciones a un histograma del 1 al 5.
   */
  buildHistogram(rawRatings) {
    const histogram = [1, 2, 3, 4, 5].map(star => {
      const found = rawRatings.find(r => Number(r.rating) === star);
      return {
        rating: star,
        count: found ? Number(found.count) : 0
      };
    });
    return histogram;
  }
}
