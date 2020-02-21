/**
 * Class that handles interactions with the Slotty API.
 */
export class API {
  /**
   * Prefix from base URL that the API routes are located at.
   * @type {String}
   */
  baseUrl = '';

  /**
   * Construct a new API instance with the given parameters. If no special params are required, it is recommended to use the API instance exported by default from api.js.
   * @param {String} baseUrl Base URL prefix for API routes.
   */
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  apiUrl(resource) {
    return `${this.baseUrl}/${resource}`;
  }

  async apiFetch(resource, options = {}) {
    // reject the request when a error status is returned
    return fetch(this.apiUrl(resource), {
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    })
      .then(res => (res.ok ? res : Promise.reject(res.statusText)))
      .then(res => res.json());
  }

  async getNotification(accessKey) {
    return this.apiFetch(`notifications/${accessKey}`);
  }

  async updateNotification(accessKey, updates) {
    console.log({ updates });
    return this.apiFetch(`notifications/${accessKey}`, {
      method: 'put',
      body: JSON.stringify(updates || {}),
    });
  }

  async createNotification(notification) {
    return this.apiFetch('notifications', {
      method: 'post',
      body: JSON.stringify(notification),
    });
  }

  async getRun(runId) {
    return this.apiFetch(`runs/${runId}`);
  }

  async listRuns(accessKey, limit = -1) {
    return this.apiFetch(`runs/list/${accessKey}/${limit}`);
  }
}

export default new API('/api');
