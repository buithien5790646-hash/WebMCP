import { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface AISiteConfig {
  name: string;
  address: string;
  browser?: string;
}

interface AppConfig {
  browser: string;
  aiSites: AISiteConfig[];
}

interface SettingsViewProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
}

export default function SettingsView({ config, onSave }: SettingsViewProps) {
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLocalConfig(JSON.parse(JSON.stringify(config)));
    setIsDirty(false);
  }, [config]);

  const handleAddSite = () => {
    setLocalConfig(prev => ({
      ...prev,
      aiSites: [...prev.aiSites, { name: 'New Site', address: 'https://', browser: 'default' }]
    }));
    setIsDirty(true);
  };

  const handleRemoveSite = (index: number) => {
    setLocalConfig(prev => ({
      ...prev,
      aiSites: prev.aiSites.filter((_, i) => i !== index)
    }));
    setIsDirty(true);
  };

  const updateSite = (index: number, field: keyof AISiteConfig, value: string) => {
    const newSites = [...localConfig.aiSites];
    newSites[index] = { ...newSites[index], [field]: value };
    setLocalConfig({ ...localConfig, aiSites: newSites });
    setIsDirty(true);
  };

  const updateGlobalBrowser = (val: string) => {
      setLocalConfig({ ...localConfig, browser: val });
      setIsDirty(true);
  }

  const handleSave = () => {
    onSave(localConfig);
    setIsDirty(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
            <p className="text-muted-foreground">Manage global application preferences.</p>
        </div>
        <Button onClick={handleSave} disabled={!isDirty}>
            <Save className="w-4 h-4 mr-2" /> Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Browser Preferences</CardTitle>
            <CardDescription>Configure how WebMCP opens links and AI clients.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-3 max-w-md">
                <label className="text-sm font-medium">Default Browser</label>
                <Select 
                  value={localConfig.browser} 
                  onValueChange={updateGlobalBrowser}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">System Default</SelectItem>
                    <SelectItem value="chrome">Google Chrome</SelectItem>
                    <SelectItem value="edge">Microsoft Edge</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    Unless specified otherwise, this browser will be used for all Launch actions.
                </p>
            </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col min-h-[400px]">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>AI Sites</CardTitle>
                <CardDescription>Customize the list of AI clients available in the quick launch menu.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddSite}>
                 <Plus className="w-4 h-4 mr-2" /> Add Site
            </Button>
        </CardHeader>
        <CardContent className="flex-1">
            <div className="space-y-2">
                <div className="grid grid-cols-12 gap-4 mb-2 px-2 text-xs font-medium text-muted-foreground">
                    <div className="col-span-3">Name</div>
                    <div className="col-span-6">URL</div>
                    <div className="col-span-2">Browser Override</div>
                    <div className="col-span-1"></div>
                </div>
                <ScrollArea className="h-[300px]">
                    <div className="space-y-2 pr-4">
                        {localConfig.aiSites.map((site, index) => (
                        <div key={index} className="grid grid-cols-12 gap-4 items-center p-2 bg-muted/20 rounded-md border">
                            <div className="col-span-3">
                            <Input 
                                className="h-8"
                                value={site.name} 
                                onChange={e => updateSite(index, 'name', e.target.value)} 
                            />
                            </div>
                            <div className="col-span-6">
                            <Input 
                                className="h-8 font-mono text-xs"
                                value={site.address} 
                                onChange={e => updateSite(index, 'address', e.target.value)} 
                            />
                            </div>
                            <div className="col-span-2">
                            <Select 
                                value={site.browser || 'default'} 
                                onValueChange={(val) => updateSite(index, 'browser', val)}
                            >
                                <SelectTrigger className="h-8">
                                <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem value="default">Default</SelectItem>
                                <SelectItem value="chrome">Chrome</SelectItem>
                                <SelectItem value="edge">Edge</SelectItem>
                                </SelectContent>
                            </Select>
                            </div>
                            <div className="col-span-1 text-right">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveSite(index)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                            </div>
                        </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}