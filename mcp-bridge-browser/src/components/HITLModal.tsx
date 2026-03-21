import { Component, h } from 'preact';
import { t } from '../core/i18n';
import { ToolExecutionPayload } from '../types';

/**
 * 人工审批 (Human-In-The-Loop) 弹窗组件的属性定义
 */
interface HITLModalProps {
  payload: ToolExecutionPayload;                // 当前被拦截的工具调用载荷
  onConfirm: (alwaysAllow: boolean) => void;    // 用户允许执行的回调函数
  onReject: (reason: string) => void;           // 用户拒绝执行的回调函数
  onClose: () => void;                          // 取消或关闭弹窗的回调函数
}

// 定义弹窗支持的三种不同视图状态
type ViewState = 'MAIN' | 'ALWAYS_CONFIRM' | 'REJECT_CONFIRM';

interface HITLModalState {
  view: ViewState;        // 当前展示的视图
  rejectReason: string;   // 用户输入的拒绝理由
}

// 解决 JSX 编译时的导入警告
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _h = h;
// @ts-ignore
if (typeof _h === 'undefined') { /* noop */ }

/**
 * 核心安全机制组件：HITL 审批弹窗
 * 当 AI 尝试调用未经授权的 MCP 工具时（例如修改文件、执行高危命令），
 * 此弹窗会阻断执行流，要求用户必须人工阅读参数并点击审批。
 */
export class HITLModal extends Component<HITLModalProps, HITLModalState> {
  constructor(props: HITLModalProps) {
    super(props);
    this.state = {
      view: 'MAIN',
      rejectReason: ''
    };
  }

  /**
   * 简单的 HTML 转义函数，防止将含有特殊符号的工具参数直接渲染到页面时引起 XSS 或排版问题
   */
  escapeHtml = (unsafe: string) => {
    return (unsafe || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  /** 处理用户点击 "允许单次执行" */
  handleConfirm = () => {
    this.props.onConfirm(false);
  };

  /** 处理用户点击 "永久允许"：切换到二次确认视图 */
  handleAlwaysClick = () => {
    this.setState({ view: 'ALWAYS_CONFIRM' });
  };

  /** 处理用户二次确认 "永久允许" */
  handleAlwaysConfirm = () => {
    this.props.onConfirm(true);
  };

  /** 处理用户点击 "拒绝"：切换到填写理由视图，或直接拒绝 */
  handleRejectClick = () => {
    if (this.state.view === 'MAIN') {
      this.setState({ view: 'REJECT_CONFIRM' });
    } else if (this.state.view === 'REJECT_CONFIRM') {
      this.props.onReject(this.state.rejectReason.trim() || 'User rejected execution');
    }
  };

  /** 处理各类视图下的 "返回" 动作 */
  handleBack = () => {
    this.setState({ view: 'MAIN', rejectReason: '' });
  };

  /** 监听回车键：在拒绝理由输入框中按回车直接提交 */
  handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && this.state.view === 'REJECT_CONFIRM') {
      this.handleRejectClick();
    }
  };

  render() {
    const { payload } = this.props;
    const { view, rejectReason } = this.state;

    // 解析并转义待显示的载荷信息
    const safeArgs = this.escapeHtml(JSON.stringify(payload.arguments || {}, null, 2));
    const safeName = this.escapeHtml(payload.name);
    const safePurpose = this.escapeHtml((payload as any).purpose || "No purpose provided.");

    // 内联样式定义，利用 Shadow DOM 隔离宿主样式
    const styles = `
      .overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; z-index: 999999; }
      .card { background: #fff; padding: 24px; border-radius: 12px; width: 450px; max-width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.4); border: 1px solid #e0e0e0; color: #333; animation: fadeIn 0.2s ease-out; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      h2 { margin: 0 0 16px 0; color: #d32f2f; display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 600; }
      .warn-icon { font-size: 24px; }
      .field { margin-bottom: 16px; }
      .label { font-weight: 600; font-size: 12px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: block; }
      .value { background: #f8f9fa; padding: 10px; border-radius: 6px; font-family: "Menlo", "Consolas", monospace; font-size: 13px; white-space: pre-wrap; word-break: break-all; max-height: 250px; overflow-y: auto; border: 1px solid #e9ecef; color: #212529; }
      .buttons { display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end; align-items: center; }
      button { padding: 10px 20px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s; }
      button:hover { transform: translateY(-1px); box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
      .btn-reject { background: #fff; color: #dc3545; border: 1px solid #dc3545; }
      .btn-reject:hover { background: #dc3545; color: white; }
      .btn-confirm { background: #2e7d32; color: white; box-shadow: 0 2px 5px rgba(46, 125, 50, 0.3); }
      .btn-confirm:hover { background: #1b5e20; box-shadow: 0 4px 8px rgba(46, 125, 50, 0.4); }
      .btn-always { background: #ff9800; color: white; margin-right: auto; }
      .btn-always:hover { background: #f57c00; }
      .btn-back { background: #6c757d; color: white; margin-right: auto; }
      .btn-back:hover { background: #5a6268; }
      input.reason { width: 100%; box-sizing: border-box; padding: 10px; margin-top: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; }
      input.reason:focus { outline: none; border-color: #dc3545; }
    `;

    return (
      <div class="overlay">
        <style dangerouslySetInnerHTML={{ __html: styles }} />
        <div class="card">
          <h2><span class="warn-icon">✋</span> {t('hitl_title')}</h2>

          {/* 默认视图：展示工具的名称、意图和具体参数 */}
          {view === 'MAIN' && (
            <div id="view-main">
              <div class="field">
                <span class="label">{t('label_tool')}</span>
                <div class="value" style={{ fontWeight: 'bold', color: '#d32f2f' }}>{safeName}</div>
              </div>
              <div class="field">
                <span class="label">{t('label_purpose')}</span>
                <div class="value" style={{ color: '#1976d2', fontWeight: 500 }}>{safePurpose}</div>
              </div>
              <div class="field">
                <span class="label">{t('label_args')}</span>
                <div class="value">{safeArgs}</div>
              </div>
            </div>
          )}

          {/* 二次确认视图：询问是否永久允许此工具执行 */}
          {view === 'ALWAYS_CONFIRM' && (
            <div id="view-always-confirm" style={{ padding: '15px 0', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔓</div>
              <p style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '16px', margin: '0 0 10px 0' }}>{t('always_title')}</p>
              <p style={{ color: '#666', fontSize: '13px', lineHeight: '1.5', margin: '0' }}>
                {t('always_desc_1')} <b>{safeName}</b>.<br />
                {t('always_desc_2')}
              </p>
            </div>
          )}

          {/* 拒绝确认视图：允许用户输入拒绝的原因反馈给 AI */}
          {view === 'REJECT_CONFIRM' && (
            <input
              type="text"
              class="reason"
              placeholder={t('placeholder_reason')}
              value={rejectReason}
              onInput={e => this.setState({ rejectReason: (e.target as HTMLInputElement).value })}
              onKeyDown={this.handleKeyDown}
              autoFocus
            />
          )}

          <div class="buttons">
            {view === 'MAIN' && (
              <>
                <button class="btn-always" onClick={this.handleAlwaysClick}>{t('btn_always')}</button>
                <button class="btn-reject" onClick={this.handleRejectClick}>{t('btn_reject')}</button>
                <button class="btn-confirm" onClick={this.handleConfirm}>{t('btn_approve')}</button>
              </>
            )}

            {view === 'ALWAYS_CONFIRM' && (
              <>
                <button class="btn-back" onClick={this.handleBack}>{t('btn_back')}</button>
                <button class="btn-always" onClick={this.handleAlwaysConfirm}>{t('btn_allow_confirm')}</button>
              </>
            )}

            {view === 'REJECT_CONFIRM' && (
              <>
                <button class="btn-back" onClick={this.handleBack}>{t('btn_back')}</button>
                <button class="btn-reject" onClick={this.handleRejectClick}>{t('btn_reject_confirm')}</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
}
