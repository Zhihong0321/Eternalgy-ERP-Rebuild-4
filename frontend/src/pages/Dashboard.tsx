import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Database,
  Users,
  AlertCircle,
  Calendar,
  Target,
  PieChart,
  ArrowUpRight,
  Eye,
  Filter,
  Search,
  MoreVertical,
} from 'lucide-react';
import { useEternalgyAPI } from '@/hooks/useEternalgyAPI';
import type { DataType as APIDataType } from '@/hooks/useEternalgyAPI';

const Dashboard = () => {
  const { getDataTypes, getSyncStatus, checkHealth, loading, error } = useEternalgyAPI();
  const [dataTypes] = useState<APIDataType[]>([]);

  // Static design first - will connect to API later
  console.log('API available:', { getDataTypes, getSyncStatus, checkHealth, loading, error, dataTypes });

  return (
    <div className="min-h-screen">
      {/* Clean Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-900">Customer Information</h1>
            <div className="flex items-center space-x-4 mt-1">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                <ArrowUpRight className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                <Filter className="h-4 w-4 mr-1" />
                Filter
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            {/* Summary Stats */}
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">$1,980,130</div>
              <div className="text-sm text-gray-500 flex items-center">
                Won from % Deals This Month
                <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs">-11% down</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">89</div>
              <div className="text-sm text-gray-500 flex items-center">
                New Customers for Week
                <span className="ml-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">+12 new</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">31</div>
              <div className="text-sm text-gray-500 flex items-center">
                New Tasks for Week
                <span className="ml-2 text-gray-500 text-xs">+6 today</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout - Three Columns */}
      <div className="p-8 space-y-6">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Interaction History */}
          <div className="col-span-8">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-heading font-semibold text-gray-900">Interaction History</h2>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" className="text-gray-500">
                    <MoreVertical className="h-4 w-4 mr-1" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-gray-500">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-gray-500">
                    <Filter className="h-4 w-4 mr-1" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-gray-500">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Interaction Cards Grid */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {/* Blue Card - Royal Package */}
<Card className="bg-gradient-to-br from-[#cfdcf3] to-[#dae4f6] text-slate-900 border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-100 text-sm">Oct 4</span>
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="font-heading font-semibold mb-1">Royal Package</h3>
<p className="text-slate-600 text-sm mb-4">Opportunity</p>
                  <div className="text-2xl font-bold mb-2">11,250$</div>
                  <div className="flex items-center -space-x-1">
                    <div className="w-6 h-6 bg-orange-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold">A</div>
                    <div className="w-6 h-6 bg-green-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold">B</div>
                    <div className="w-6 h-6 bg-purple-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold">C</div>
                  </div>
                </CardContent>
              </Card>

              {/* Teal Card - Third Deal */}
<Card className="bg-gradient-to-br from-[#cfeee7] to-[#daf3ee] text-slate-900 border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-teal-100 text-sm">Oct 16</span>
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="font-heading font-semibold mb-1">Third Deal:</h3>
<p className="text-slate-600 text-sm mb-4">Most Useful</p>
                  <div className="text-2xl font-bold mb-2">21,300$</div>
                  <div className="flex items-center -space-x-1">
                    <div className="w-6 h-6 bg-orange-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold">M</div>
                    <div className="w-6 h-6 bg-green-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold">J</div>
                    <div className="w-6 h-6 bg-purple-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold">S</div>
                    <div className="w-6 h-6 bg-blue-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold">T</div>
                  </div>
                </CardContent>
              </Card>

              {/* Dark Card - Absolute Success Deal */}
<Card className="bg-gradient-to-br from-slate-900 to-black text-white border border-slate-800 shadow-md hover:shadow-lg transition-shadow cursor-pointer relative">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300 text-sm">Oct 12</span>
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                      <ArrowUpRight className="h-4 w-4 text-black" />
                    </div>
                  </div>
                  <h3 className="font-heading font-semibold mb-1">Absolute</h3>
                  <p className="text-gray-300 text-sm mb-4">Success Deal</p>
                  <div className="text-2xl font-bold mb-2">2,100$</div>
                  <div className="flex items-center -space-x-1">
                    <div className="w-6 h-6 bg-orange-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold">D</div>
                    <div className="w-6 h-6 bg-green-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold">L</div>
                    <div className="w-6 h-6 bg-purple-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold">K</div>
                  </div>
                </CardContent>
              </Card>

              {/* Yellow Card - Royal Package */}
<Card className="bg-gradient-to-br from-[#f6f1c8] to-[#f3ecc0] text-slate-900 border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-yellow-800 text-sm">Oct 11</span>
                    <Button variant="ghost" size="sm" className="text-gray-900 hover:bg-black/10">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="font-heading font-semibold mb-1">Royal Package</h3>
<p className="text-slate-600 text-sm mb-4">Opportunity</p>
                  <div className="text-2xl font-bold mb-2">4,160$</div>
                  <div className="flex items-center -space-x-1">
                    <div className="w-6 h-6 bg-purple-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white">R</div>
                    <div className="w-6 h-6 bg-green-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white">A</div>
                    <div className="w-6 h-6 bg-blue-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white">M</div>
                  </div>
                </CardContent>
              </Card>

              {/* Light Gray Card - Adaptive Business Services */}

<Card className="bg-white/80 backdrop-blur rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 text-sm">Oct 2</span>
                    <Button variant="ghost" size="sm" className="text-gray-500 hover:bg-gray-100">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="font-heading font-semibold mb-1 text-gray-900">Adaptive</h3>
                  <p className="text-gray-500 text-sm mb-4">Business Services</p>
                  <div className="text-2xl font-bold mb-2 text-gray-900">3,140$</div>
                  <div className="flex items-center -space-x-1">
                    <div className="w-6 h-6 bg-orange-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white">P</div>
                    <div className="w-6 h-6 bg-green-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white">Q</div>
                    <div className="w-6 h-6 bg-purple-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white">R</div>
                  </div>
                </CardContent>
              </Card>

              {/* Light Gray Card - Second Deal */}
              <Card className="bg-white/80 backdrop-blur rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 text-sm">Oct 2</span>
                    <Button variant="ghost" size="sm" className="text-gray-500 hover:bg-gray-100">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="font-heading font-semibold mb-1 text-gray-900">Second deal:</h3>
                  <p className="text-gray-500 text-sm mb-4">Common Service</p>
                  <div className="text-2xl font-bold mb-2 text-gray-900">12,350$</div>
                  <div className="flex items-center -space-x-1">
                    <div className="w-6 h-6 bg-orange-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white">X</div>
                    <div className="w-6 h-6 bg-green-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white">Y</div>
                    <div className="w-6 h-6 bg-purple-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white">Z</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottom Section - Tasks Schedule and Stage Funnel */}
            <div className="grid grid-cols-2 gap-6">
              {/* Tasks Schedule */}

<Card className="bg-white/80 backdrop-blur rounded-xl border border-slate-200 shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-900">Tasks Schedule</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" className="text-gray-500">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-500">
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <Button variant="ghost" size="sm">←</Button>
                      <h3 className="font-semibold text-gray-900">October</h3>
                      <Button variant="ghost" size="sm">→</Button>
                    </div>
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1 text-center text-sm">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <div key={i} className="p-2 text-gray-500 font-medium">{day}</div>
                    ))}
                    {/* Calendar days */}
                    <div className="p-2">1</div>
                    <div className="p-2 bg-blue-500 text-white rounded font-semibold">2</div>
                    <div className="p-2 bg-orange-400 text-white rounded font-semibold">3</div>
                    <div className="p-2 bg-blue-500 text-white rounded font-semibold">4</div>
                    <div className="p-2">5</div>
                    <div className="p-2">6</div>
                    <div className="p-2">7</div>
                    <div className="p-2">8</div>
                    <div className="p-2">9</div>
                    <div className="p-2">10</div>
                    <div className="p-2 bg-yellow-400 text-white rounded font-semibold">11</div>
                    <div className="p-2 bg-gray-800 text-white rounded font-semibold">12</div>
                    <div className="p-2">13</div>
                    <div className="p-2">14</div>
                    <div className="p-2">15</div>
                    <div className="p-2 bg-teal-500 text-white rounded font-semibold">16</div>
                    <div className="p-2">17</div>
                    <div className="p-2">18</div>
                    <div className="p-2">19</div>
                    <div className="p-2">20</div>
                    <div className="p-2">21</div>
                  </div>
                </CardContent>
              </Card>

              {/* Stage Funnel */}
              <Card className="bg-white border border-gray-200 shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-900">Stage Funnel</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" className="text-gray-500">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-500">
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">$350,500</div>
                    <div className="text-sm text-gray-500 flex items-center justify-center mt-1">
                      Total Pipeline
                      <div className="ml-2 flex items-center space-x-2">
                        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                        <span className="text-xs">Weighted</span>
                        <span className="w-2 h-2 bg-gray-600 rounded-full"></span>
                        <span className="text-xs">Total</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">Qualification</span>
                        <div className="flex items-center space-x-1">
                          <PieChart className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                      <div className="text-lg font-semibold text-gray-900">92,350$</div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">Royal Package Opportunity</span>
                        <div className="flex items-center space-x-1">
                          <PieChart className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                      <div className="text-lg font-semibold text-gray-900">67,120$</div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">Value Proposition</span>
                        <div className="flex items-center space-x-1">
                          <PieChart className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                      <div className="text-lg font-semibold text-gray-900">78,920$</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column - Customer Details */}
          <div className="col-span-4">
            <Card className="bg-white border border-gray-200 shadow-lg">
              <CardContent className="p-6">
                {/* Profile Section */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-white text-xl font-bold">ER</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Eva Robinson</h3>
                  <p className="text-sm text-gray-500">CEO, Inc Alabama Machinery & Supply</p>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-5 gap-2 mb-6">
                  <Button variant="ghost" size="sm" className="p-2">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Database className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="p-2">
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Calendar className="h-4 w-4" />
                  </Button>
                </div>

                {/* Details Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">Detailed Information</h4>
                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="sm">
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">First Name</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Eva</span>
                        <Button variant="ghost" size="sm">
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Last Name</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Robinson</span>
                        <Button variant="ghost" size="sm">
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Email</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Eva@alabamamachinery.com</span>
                        <Button variant="ghost" size="sm">
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Phone Number</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">+911 120 222 313</span>
                        <Button variant="ghost" size="sm">
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-2">
                        <Target className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Sources</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-5 h-5 bg-green-500 rounded flex items-center justify-center">
                            <span className="text-white text-xs">W</span>
                          </div>
                          <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center">
                            <span className="text-white text-xs">G</span>
                          </div>
                          <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                            <span className="text-white text-xs">L</span>
                          </div>
                          <div className="w-5 h-5 bg-purple-500 rounded flex items-center justify-center">
                            <span className="text-white text-xs">M</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Last Connected</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">06/15/2023 at 7:16 pm</span>
                        <Button variant="ghost" size="sm">
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;