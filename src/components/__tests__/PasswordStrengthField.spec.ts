import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PasswordStrengthField from '../PasswordStrengthField.vue'
import { fr } from '../../i18n/locales/fr'

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) => {
      let str = fr[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`{${k}}`, 'g'), String(v))
        }
      }
      return str
    },
  }),
}))

describe('PasswordStrengthField', () => {
  it('affiche la checklist et la barre de force', () => {
    const wrapper = mount(PasswordStrengthField, {
      props: {
        modelValue: 'Pinova2026',
        label: 'Mot de passe',
      },
    })

    expect(wrapper.text()).toContain('Votre mot de passe doit :')
    expect(wrapper.text()).toContain('[v]')
    expect(wrapper.text()).toContain('Au moins 8 caractères.')
    expect(wrapper.text().replace(/\u00a0/g, ' ')).toContain('Exemple valide : Pinova2026')
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('signale les règles non respectées', async () => {
    const wrapper = mount(PasswordStrengthField, {
      props: {
        modelValue: '',
        email: 'jean@example.com',
      },
    })

    await wrapper.find('input').setValue('abc')

    expect(wrapper.text()).toContain('[x]')
    expect(wrapper.text()).toContain('Au moins 8 caractères.')
    expect(wrapper.text()).toContain('Au moins un chiffre.')
    expect(wrapper.emitted('update:valid')?.at(-1)?.[0]).toBe(false)
  })
})
