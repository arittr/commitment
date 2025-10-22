/**
 * Export functionality for data serialization
 */
export class Exporter {
  /**
   * Export data to JSON format
   *
   * @param data - Data to export
   * @returns JSON string with pretty formatting
   */
  async exportToJSON(data: unknown): Promise<string> {
    return JSON.stringify(data, null, 2);
  }
}
