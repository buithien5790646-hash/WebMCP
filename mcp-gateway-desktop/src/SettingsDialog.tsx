import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface AISiteConfig {
  name: string;
  address: string;
  browser?: string;
}

interface AppConfig {
  browser: string;
  aiSites: AISiteConfig[];
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (config: AppConfig) => void;
}

export default function SettingsDialog({ open, onClose, config, onSave }: SettingsDialogProps) {
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);

  useEffect(() => {
    if (open) setLocalConfig(JSON.parse(JSON.stringify(config)));
  }, [open, config]);

  if (!open) return null;

  const handleAddSite = () => {
    setLocalConfig(prev => ({
      ...prev,
      aiSites: [...prev.aiSites, { name: 'New Site', address: 'https://', browser: 'default' }]
    }));
  };

  const handleRemoveSite = (index: number) => {
    setLocalConfig(prev => ({
      ...prev,
      aiSites: prev.aiSites.filter((_, i) => i !== index)
    }));
  };

  const updateSite = (index: number, field: keyof AISiteConfig, value: string) => {
    const newSites = [...localConfig.aiSites];
    // @ts-ignore
    newSites[index][field] = value;
    setLocalConfig({ ...localConfig, aiSites: newSites });
  };

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-lg shadow-lg w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Settings</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Global Browser */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Global Default Browser</label>
            <Select 
              value={localConfig.browser} 
              onValueChange={(val) => setLocalConfig({ ...localConfig, browser: val })}
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
            <p className="text-xs text-muted-foreground">Which browser to use when launching AI sites (unless overridden below).</p>
          </div>

          <div className="border-t" />

          {/* AI Sites List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
               <label className="text-sm font-medium">AI Sites Configuration</label>
               <Button variant="outline" size="sm" onClick={handleAddSite}>
                 <Plus className="w-3 h-3 mr-2" /> Add Site
               </Button>
            </div>
            
            <ScrollArea className="h-[300px] border rounded-md p-2 bg-muted/20">
              <div className="space-y-2">
                {localConfig.aiSites.map((site, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-background rounded border group">
                    <div className="col-span-3">
                      <Input 
                        className="h-8 text-xs"
                        placeholder="Name"
                        value={site.name} 
                        onChange={e => updateSite(index, 'name', e.target.value)} 
                      />
                    </div>
                    <div className="col-span-5">
                      <Input 
                         className="h-8 text-xs font-mono"
                         placeholder="URL"
                         value={site.address} 
                         onChange={e => updateSite(index, 'address', e.target.value)} 
                      />
                    </div>
                    <div className="col-span-3">
                      <Select 
                        value={site.browser || 'default'} 
                        onValueChange={(val) => updateSite(index, 'browser', val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
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

        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-end gap-2 bg-muted/10">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" /> Save Changes</Button>
        </div>
      </div>
    </div>
  );
}