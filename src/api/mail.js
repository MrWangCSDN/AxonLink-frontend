/**
 * 邮件服务 API
 *
 * 后端对应：com.axonlink.notification.controller.MailController
 * 路由前缀：/api/mail
 *
 * 通用邮件发送能力（无业务模板，业务侧自行组织 subject / body）。
 */
import { request } from './index.js'

/**
 * 发送邮件（异步）。
 * @param {object} payload { to, cc?, bcc?, subject, body, html? }
 * @returns {Promise<{accepted: boolean, to: string[], html: boolean, subject: string}>}
 */
export function sendMail(payload) {
  return request('/mail/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * 测试 SMTP 配置连通性。
 * @param {string} to 收件人
 */
export function testMail(to) {
  return request('/mail/test', {
    method: 'POST',
    body: JSON.stringify({ to }),
  })
}
