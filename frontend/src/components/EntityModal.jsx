import { useEffect, useState } from 'react'
import { formConfig as allFormConfig, tableConfig as allTableConfig } from '../config/modules'
import Modal from './Modal'
import { formatValue } from '../utils/formatters'
import { buildPayload, initialFormState, validateForm } from '../utils/forms'
import { LoadingState } from './StateMessage'

function EntityModal({
  api,
  config,
  formConfig,
  mode,
  row,
  setError,
  onClose,
  onSaved,
  relatedActions = {},
  initialValues,
  guideText,
}) {
  const safeInitialValues = initialValues || {}
  const initialValuesKey = JSON.stringify(safeInitialValues)
  const [form, setForm] = useState(() => initialFormState(formConfig.fields, row, mode, safeInitialValues))
  const [options, setOptions] = useState({})
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [relatedModal, setRelatedModal] = useState(null)
  const isDetail = mode === 'detail'

  const badgeMap = { create: 'Nuevo registro', edit: 'Editar', detail: 'Detalle' }
  const badge = badgeMap[mode] || 'Formulario'
  const title = mode === 'create'
    ? `Nuevo: ${config.title}`
    : mode === 'edit'
      ? `Editar: ${config.title}`
      : `${config.title}`

  const editableFields = formConfig.fields.filter((field) => !shouldHideField(field, row, mode, form))

  useEffect(() => {
    setForm(initialFormState(formConfig.fields, row, mode, safeInitialValues))
  }, [formConfig, row, mode, initialValuesKey])

  async function loadOptions() {
    const optionSources = formConfig.options || []
    if (!optionSources.length || isDetail) return
    setLoadingOptions(true)
    return Promise.all(optionSources.map((source) => api.request(source.path)))
      .then((responses) => {
        const nextOptions = {}
        optionSources.forEach((source, index) => {
          nextOptions[source.name] = responses[index].data || []
        })
        setOptions(nextOptions)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingOptions(false))
  }

  useEffect(() => { loadOptions() }, [api, formConfig.options, isDetail, setError])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    const validationError = validateForm(editableFields, form, mode)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = buildPayload(editableFields, form, mode)
      const body = await api.request(
        mode === 'create' ? config.path : `${config.path}/${row.id}`,
        { method: mode === 'create' ? 'POST' : 'PUT', body: JSON.stringify(payload) }
      )
      await onSaved(body?.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title} badge={badge} onClose={onClose} size="large">
      {isDetail ? (
        <div className="mf">
          <dl className="em-detail-grid">
            {Object.entries(row || {}).map(([key, value]) => (
              <div key={key} className="em-detail-row">
                <dt>{key}</dt>
                <dd>{formatValue(value) || <span className="ld-empty">—</span>}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <form className="mf" onSubmit={submit}>
          {guideText && (
            <div className="mf-hint mf-hint-info">{guideText}</div>
          )}
          {loadingOptions ? (
            <LoadingState message="Cargando opciones..." />
          ) : (
            <div className="mf-grid">
              {editableFields.map((field) => {
                const optionConfig = (formConfig.options || []).find(
                  (source) => source.name === field.optionSource
                )
                const generatedAction = optionConfig?.createModule
                  ? {
                    label: `+ ${optionConfig.createLabel || 'Crear nuevo'}`,
                    onClick: () => setRelatedModal({ fieldName: field.name, moduleId: optionConfig.createModule }),
                  }
                  : null

                return (
                  <FieldControl
                    key={field.name}
                    field={field}
                    value={form[field.name]}
                    optionConfig={optionConfig}
                    options={options[field.optionSource] || []}
                    relatedAction={relatedActions[field.name] || generatedAction}
                    disabled={saving || shouldDisableField(field, row, mode)}
                    mode={mode}
                    onChange={(value) => updateField(field.name, value)}
                  />
                )
              })}
            </div>
          )}

          <div className="mf-actions">
            <button type="button" className="mf-btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="mf-btn-confirm" disabled={saving || loadingOptions}>
              {saving ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}

      {relatedModal && (
        <EntityModal
          api={api}
          config={allTableConfig[relatedModal.moduleId]}
          formConfig={allFormConfig[relatedModal.moduleId]}
          mode="create"
          row={null}
          setError={setError}
          initialValues={relatedModal.initialValues || {}}
          guideText={allFormConfig[relatedModal.moduleId]?.guideText}
          onClose={() => setRelatedModal(null)}
          onSaved={async (createdRow) => {
            setRelatedModal(null)
            await loadOptions()
            if (createdRow?.id) updateField(relatedModal.fieldName, String(createdRow.id))
          }}
        />
      )}
    </Modal>
  )
}

function FieldControl({ field, value, optionConfig, options, relatedAction, disabled, mode, onChange }) {
  const [showSecret, setShowSecret] = useState(false)
  const isFull = field.full
  const required = field.required || (mode === 'create' && field.requiredOnCreate)

  if (field.type === 'checkbox') {
    return (
      <div className={`em-checkbox-wrap${isFull ? ' mf-field-full' : ''}`}>
        <label className="em-checkbox">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div className={`mf-field${isFull ? ' mf-field-full' : ''}`}>
        <label>
          {field.label}
          {required && <span className="mf-required"> *</span>}
        </label>
        <textarea
          value={value || ''}
          maxLength={field.maxLength}
          disabled={disabled}
          rows="3"
          onChange={(e) => onChange(e.target.value)}
        />
        {field.help && <p className="mf-help">{field.help}</p>}
      </div>
    )
  }

  if (field.type === 'select') {
    const choices = field.staticOptions || options.map((item) => ({
      value: item.id,
      label: optionConfig?.secondaryKey
        ? `${item[optionConfig.labelKey] || 'Sin nombre'} · ${item[optionConfig.secondaryKey] || ''}`
        : item[optionConfig?.labelKey] || 'Sin nombre',
    }))

    return (
      <div className={`mf-field${isFull ? ' mf-field-full' : ''}`}>
        <div className="mf-field-header">
          <label>
            {field.label}
            {required && <span className="mf-required"> *</span>}
          </label>
          {relatedAction && (
            <button type="button" className="mf-inline-link" onClick={relatedAction.onClick}>
              {relatedAction.label}
            </button>
          )}
        </div>
        <select
          value={value || ''}
          required={required}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Seleccionar...</option>
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>{choice.label}</option>
          ))}
        </select>
        {field.help && <p className="mf-help">{field.help}</p>}
      </div>
    )
  }

  if (field.type === 'password') {
    return (
      <div className={`mf-field${isFull ? ' mf-field-full' : ''}`}>
        <label>
          {field.label}
          {required && <span className="mf-required"> *</span>}
        </label>
        <div className="mf-password-wrap">
          <input
            type={showSecret ? 'text' : 'password'}
            value={value || ''}
            required={required}
            min={field.min}
            step={field.step}
            pattern={field.pattern}
            title={field.title}
            maxLength={field.maxLength}
            disabled={disabled}
            placeholder={field.requiredOnCreate && mode === 'edit' ? 'Dejar vacío para conservar' : ''}
            onChange={(e) => {
              onChange(field.transform === 'uppercase' ? e.target.value.toUpperCase() : e.target.value)
            }}
          />
          <button
            type="button"
            className="mf-toggle-vis"
            disabled={disabled}
            onClick={() => setShowSecret((v) => !v)}
            title={showSecret ? 'Ocultar' : 'Mostrar'}
          >
            {showSecret ? (
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {field.help && <p className="mf-help">{field.help}</p>}
      </div>
    )
  }

  // Input genérico (text, number, date, email, etc.)
  return (
    <div className={`mf-field${isFull ? ' mf-field-full' : ''}`}>
      <label>
        {field.label}
        {required && <span className="mf-required"> *</span>}
      </label>
      <input
        type={field.type || 'text'}
        value={value || ''}
        required={required}
        min={field.min}
        step={field.step}
        pattern={field.pattern}
        title={field.title}
        maxLength={field.maxLength}
        disabled={disabled}
        placeholder={field.requiredOnCreate && mode === 'edit' ? 'Dejar vacío para conservar' : (field.placeholder || '')}
        onChange={(e) => {
          onChange(field.transform === 'uppercase' ? e.target.value.toUpperCase() : e.target.value)
        }}
      />
      {field.help && <p className="mf-help">{field.help}</p>}
    </div>
  )
}

function shouldHideField(field, row, mode, form = {}) {
  if (mode === 'edit' && field.hideOnEdit) return true
  if (mode === 'edit' && field.hideOnEditForStatuses?.includes(row?.status)) return true
  if (field.showWhen) {
    return !Object.entries(field.showWhen).every(([key, expected]) => form?.[key] === expected)
  }
  if (mode !== 'edit' || !field.hideOnEditWhen) return false
  return Object.entries(field.hideOnEditWhen).every(([key, expected]) => row?.[key] === expected)
}

function shouldDisableField(field, row, mode) {
  if (mode === 'edit' && field.disabledOnEditForStatuses?.includes(row?.status)) return true
  if (mode !== 'edit' || !field.disabledOnEditWhen) return false
  return Object.entries(field.disabledOnEditWhen).every(([key, expected]) => row?.[key] === expected)
}

export default EntityModal
