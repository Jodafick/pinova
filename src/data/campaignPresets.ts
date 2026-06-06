export type CampaignPresetId = 'launch' | 'traffic' | 'community'

export type CampaignPreset = {
  id: CampaignPresetId
  headlineKey: string
  bodyKey: string
  ctaLabelKey: string
}

export const CAMPAIGN_PRESETS: CampaignPreset[] = [
  {
    id: 'launch',
    headlineKey: 'promote.campaigns.preset.launch.headline',
    bodyKey: 'promote.campaigns.preset.launch.body',
    ctaLabelKey: 'promote.campaigns.preset.launch.cta',
  },
  {
    id: 'traffic',
    headlineKey: 'promote.campaigns.preset.traffic.headline',
    bodyKey: 'promote.campaigns.preset.traffic.body',
    ctaLabelKey: 'promote.campaigns.preset.traffic.cta',
  },
  {
    id: 'community',
    headlineKey: 'promote.campaigns.preset.community.headline',
    bodyKey: 'promote.campaigns.preset.community.body',
    ctaLabelKey: 'promote.campaigns.preset.community.cta',
  },
]
